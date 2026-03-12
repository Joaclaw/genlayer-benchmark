# { "Depends": "py-genlayer:latest" }
from genlayer import *
import json


@allow_storage
class MultiURLResult:
    market_id: str
    question: str
    urls_used: str  # JSON array of URLs

    # Per-URL responses
    url_responses: str  # JSON array of {url, answer, content_preview, error}

    # Final resolution
    final_answer: str  # YES | NO | UNCERTAIN
    expected: str  # Polymarket ground truth
    correct: bool
    consensus_count: u256  # How many URLs agreed (2/3 or 3/3)

    # Diagnostics
    urls_fetched: u256  # How many URLs were successfully fetched
    urls_failed: u256   # How many URLs failed to fetch
    reasoning: str      # Combined reasoning from sources

    timestamp: str

    def __init__(
        self,
        market_id: str,
        question: str,
        urls_used: str,
        url_responses: str,
        final_answer: str,
        expected: str,
        correct: bool,
        consensus_count: u256,
        urls_fetched: u256,
        urls_failed: u256,
        reasoning: str,
        timestamp: str
    ):
        self.market_id = market_id
        self.question = question
        self.urls_used = urls_used
        self.url_responses = url_responses
        self.final_answer = final_answer
        self.expected = expected
        self.correct = correct
        self.consensus_count = consensus_count
        self.urls_fetched = urls_fetched
        self.urls_failed = urls_failed
        self.reasoning = reasoning
        self.timestamp = timestamp

    def to_dict(self) -> dict:
        return {
            "market_id": self.market_id,
            "question": self.question,
            "urls_used": json.loads(self.urls_used),
            "url_responses": json.loads(self.url_responses),
            "final_answer": self.final_answer,
            "expected": self.expected,
            "correct": self.correct,
            "consensus_count": int(self.consensus_count),
            "urls_fetched": int(self.urls_fetched),
            "urls_failed": int(self.urls_failed),
            "reasoning": self.reasoning,
            "timestamp": self.timestamp
        }


class MultiURLResolver(gl.Contract):
    results: DynArray[MultiURLResult]

    def __init__(self):
        pass

    @gl.public.write
    def resolve_market(
        self,
        market_id: str,
        question: str,
        url1: str,
        url2: str,
        url3: str,
        expected: str
    ) -> dict:
        """
        Resolve a market using 3 pre-validated URLs.

        Each URL is fetched independently, the LLM extracts YES/NO from each,
        and a 2/3 majority vote determines the final answer.

        Args:
            market_id: Unique market identifier
            question: The prediction market question
            url1, url2, url3: Three pre-validated URLs from agentic search
            expected: Polymarket ground truth (Yes/No)

        Returns:
            Resolution result with per-URL breakdown and consensus
        """
        timestamp = gl.message_raw["datetime"]
        urls = [url1, url2, url3]

        def resolve_fn() -> str:
            url_responses = []

            for url in urls:
                response = self._fetch_and_resolve(url, question)
                url_responses.append(response)

            # Count votes
            yes_count = 0
            no_count = 0
            error_count = 0
            reasonings = []

            for resp in url_responses:
                answer = resp.get("answer", "ERROR").upper()
                if "YES" in answer:
                    yes_count += 1
                elif "NO" in answer:
                    no_count += 1
                else:
                    error_count += 1

                if resp.get("reasoning"):
                    reasonings.append(resp["reasoning"])

            # Determine consensus (2/3 majority required)
            if yes_count >= 2:
                final_answer = "YES"
                consensus_count = yes_count
            elif no_count >= 2:
                final_answer = "NO"
                consensus_count = no_count
            else:
                final_answer = "UNCERTAIN"
                consensus_count = max(yes_count, no_count)

            # Check correctness
            expected_upper = expected.upper().strip()
            correct = (final_answer == expected_upper) if final_answer in ["YES", "NO"] else False

            return json.dumps({
                "url_responses": url_responses,
                "final_answer": final_answer,
                "correct": correct,
                "consensus_count": consensus_count,
                "urls_fetched": 3 - error_count,
                "urls_failed": error_count,
                "reasoning": " | ".join(reasonings[:3])
            })

        # === CONSENSUS via Optimistic Democracy ===
        result_json_str = gl.eq_principle.prompt_comparative(
            resolve_fn,
            principle="Results are equivalent if they have the same final_answer (YES/NO/UNCERTAIN) and the reasoning supports that answer from the source URLs"
        )

        # Parse result
        if isinstance(result_json_str, dict):
            result_data = result_json_str
        else:
            result_data = json.loads(result_json_str)

        final_answer = result_data.get("final_answer", "UNCERTAIN")
        expected_upper = expected.upper().strip()
        correct = (final_answer == expected_upper) if final_answer in ["YES", "NO"] else False

        market_result = MultiURLResult(
            market_id=market_id,
            question=question,
            urls_used=json.dumps(urls),
            url_responses=json.dumps(result_data.get("url_responses", [])),
            final_answer=final_answer,
            expected=expected,
            correct=correct,
            consensus_count=u256(result_data.get("consensus_count", 0)),
            urls_fetched=u256(result_data.get("urls_fetched", 0)),
            urls_failed=u256(result_data.get("urls_failed", 0)),
            reasoning=result_data.get("reasoning", ""),
            timestamp=timestamp
        )

        self.results.append(market_result)
        return market_result.to_dict()

    def _fetch_and_resolve(self, url: str, question: str) -> dict:
        """Fetch a single URL and resolve the question from its content."""
        try:
            content = gl.nondet.web.render(url, mode='text')
        except Exception as e:
            return {
                "url": url,
                "answer": "ERROR",
                "reasoning": "",
                "content_preview": f"Fetch failed: {str(e)[:200]}",
                "error": str(e)[:200]
            }

        content_stripped = content.strip() if content else ""

        if len(content_stripped) < 100:
            return {
                "url": url,
                "answer": "ERROR",
                "reasoning": "",
                "content_preview": content_stripped[:200],
                "error": f"Insufficient content ({len(content_stripped)} chars)"
            }

        # Check for anti-bot
        content_lower = content_stripped.lower()
        if any(p in content_lower for p in [
            "access denied", "please verify you are human",
            "enable javascript", "checking your browser", "captcha"
        ]):
            return {
                "url": url,
                "answer": "ERROR",
                "reasoning": "",
                "content_preview": content_stripped[:200],
                "error": "Anti-bot protection detected"
            }

        # LLM resolution
        try:
            prompt = f"""You are resolving a prediction market using information from a web page.

Question: {question}

Webpage content (from {url}):
{content_stripped[:8000]}

Based ONLY on the webpage content above, determine if this question resolved YES or NO.

Return JSON:
{{
  "answer": "YES" or "NO" or "UNRESOLVABLE",
  "reasoning": "Brief explanation citing specific evidence from the page"
}}

If the content does not contain enough information to definitively answer, return "UNRESOLVABLE"."""

            llm_response = gl.nondet.exec_prompt(prompt, response_format='json')
        except Exception as e:
            return {
                "url": url,
                "answer": "ERROR",
                "reasoning": "",
                "content_preview": content_stripped[:200],
                "error": f"LLM error: {str(e)[:150]}"
            }

        if not isinstance(llm_response, dict):
            return {
                "url": url,
                "answer": "ERROR",
                "reasoning": "",
                "content_preview": content_stripped[:200],
                "error": "LLM did not return valid JSON"
            }

        answer = llm_response.get("answer", "UNRESOLVABLE").upper().strip()
        reasoning = llm_response.get("reasoning", "")

        # Normalize answer
        if "YES" in answer:
            answer = "YES"
        elif "NO" in answer:
            answer = "NO"
        else:
            answer = "UNRESOLVABLE"

        return {
            "url": url,
            "answer": answer,
            "reasoning": reasoning,
            "content_preview": content_stripped[:300],
            "error": ""
        }

    @gl.public.view
    def get_results(self) -> str:
        """Get all resolved markets as JSON string."""
        return json.dumps([r.to_dict() for r in self.results])

    @gl.public.view
    def get_result(self, market_id: str) -> dict:
        """Get result for a specific market."""
        for r in self.results:
            if r.market_id == market_id:
                return r.to_dict()
        return {}

    @gl.public.view
    def get_result_count(self) -> int:
        """Get total number of resolved markets."""
        return len(self.results)
