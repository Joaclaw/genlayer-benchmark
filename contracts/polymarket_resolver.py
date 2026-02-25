# { "Depends": "py-genlayer:latest" }
from genlayer import *
import json


@allow_storage
class MarketResult:
    market_id: str
    question: str
    resolution_url: str
    polymarket_result: str
    
    # Resolution outcome
    resolvable: bool
    genlayer_result: str  # YES | NO | UNRESOLVABLE
    correct: bool  # genlayer matches polymarket
    
    # Diagnostics (when not resolvable)
    failure_reason: str  # web_* | content_* | llm_* | empty
    status_code: u256    # HTTP status code (0 if not applicable)
    error_detail: str    # specific error message
    
    # LLM reasoning (when resolvable)
    reasoning: str
    
    timestamp: str

    def __init__(
        self,
        market_id: str,
        question: str,
        resolution_url: str,
        polymarket_result: str,
        resolvable: bool,
        genlayer_result: str,
        correct: bool,
        failure_reason: str,
        status_code: u256,
        error_detail: str,
        reasoning: str,
        timestamp: str
    ):
        self.market_id = market_id
        self.question = question
        self.resolution_url = resolution_url
        self.polymarket_result = polymarket_result
        self.resolvable = resolvable
        self.genlayer_result = genlayer_result
        self.correct = correct
        self.failure_reason = failure_reason
        self.status_code = status_code
        self.error_detail = error_detail
        self.reasoning = reasoning
        self.timestamp = timestamp

    def to_dict(self) -> dict:
        return {
            "market_id": self.market_id,
            "question": self.question,
            "resolution_url": self.resolution_url,
            "polymarket_result": self.polymarket_result,
            "resolvable": self.resolvable,
            "genlayer_result": self.genlayer_result,
            "correct": self.correct,
            "failure_reason": self.failure_reason,
            "status_code": int(self.status_code),
            "error_detail": self.error_detail,
            "reasoning": self.reasoning,
            "timestamp": self.timestamp
        }


class PolymarketResolver(gl.Contract):
    results: DynArray[MarketResult]

    def __init__(self):
        pass

    def _normalize_url(self, url: str) -> str:
        """Ensure URL has proper protocol."""
        url = url.strip()
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
        return url

    def _parse_status_code(self, error_str: str) -> int:
        """Extract HTTP status code from error message."""
        error_lower = error_str.lower()
        if "403" in error_str:
            return 403
        elif "404" in error_str:
            return 404
        elif "500" in error_str:
            return 500
        elif "502" in error_str:
            return 502
        elif "503" in error_str:
            return 503
        elif "429" in error_str:
            return 429
        elif "401" in error_str:
            return 401
        return 0

    @gl.public.write
    def resolve_market(
        self,
        market_id: str,
        question: str,
        resolution_url: str,
        polymarket_result: str
    ) -> dict:
        """
        Resolve a single Polymarket market.
        
        Returns:
            - resolvable: bool
            - if not resolvable: failure_reason + status_code + error_detail
            - if resolvable: genlayer_result + correct + reasoning
        """
        timestamp = gl.message_raw["datetime"]
        normalized_url = self._normalize_url(resolution_url)
        
        def resolve_fn() -> str:
            # === PHASE 1: WEB FETCH ===
            status_code = 0
            try:
                content = gl.nondet.web.render(normalized_url, mode='text')
            except Exception as e:
                error_str = str(e)
                error_lower = error_str.lower()
                status_code = 0
                
                # Parse status code from error
                for code in ["403", "404", "500", "502", "503", "429", "401"]:
                    if code in error_str:
                        status_code = int(code)
                        break
                
                # Categorize web errors
                if "403" in error_str or "forbidden" in error_lower:
                    failure_reason = "web_forbidden"
                    error_detail = "403 Forbidden - access denied"
                elif "404" in error_str or "not found" in error_lower:
                    failure_reason = "web_not_found"
                    error_detail = "404 Not Found - page does not exist"
                elif "429" in error_str or "rate limit" in error_lower:
                    failure_reason = "web_rate_limited"
                    error_detail = "429 Too Many Requests - rate limited"
                elif "timeout" in error_lower or "timed out" in error_lower:
                    failure_reason = "web_timeout"
                    error_detail = "Request timed out"
                elif "ssl" in error_lower or "certificate" in error_lower:
                    failure_reason = "web_ssl_error"
                    error_detail = "SSL/certificate error"
                elif "dns" in error_lower or "resolve" in error_lower or "getaddrinfo" in error_lower:
                    failure_reason = "web_dns_error"
                    error_detail = "DNS resolution failed - domain may not exist"
                elif "connection" in error_lower or "refused" in error_lower:
                    failure_reason = "web_connection_error"
                    error_detail = "Connection refused or failed"
                elif "500" in error_str or "502" in error_str or "503" in error_str:
                    failure_reason = "web_server_error"
                    error_detail = f"Server error ({status_code})"
                else:
                    failure_reason = "web_unknown_error"
                    error_detail = error_str[:200]
                
                return json.dumps({
                    "resolvable": False,
                    "genlayer_result": "UNRESOLVABLE",
                    "failure_reason": failure_reason,
                    "status_code": status_code,
                    "error_detail": error_detail,
                    "reasoning": ""
                })
            
            # === PHASE 2: CONTENT VALIDATION ===
            content_stripped = content.strip() if content else ""
            
            if len(content_stripped) == 0:
                return json.dumps({
                    "resolvable": False,
                    "genlayer_result": "UNRESOLVABLE",
                    "failure_reason": "content_empty",
                    "status_code": 200,
                    "error_detail": "Page returned empty content",
                    "reasoning": ""
                })
            
            if len(content_stripped) < 100:
                return json.dumps({
                    "resolvable": False,
                    "genlayer_result": "UNRESOLVABLE",
                    "failure_reason": "content_insufficient",
                    "status_code": 200,
                    "error_detail": f"Page content too short ({len(content_stripped)} chars)",
                    "reasoning": ""
                })
            
            # Check for anti-bot / access denied patterns in content
            content_lower = content_stripped.lower()
            if any(pattern in content_lower for pattern in [
                "access denied", 
                "please verify you are human",
                "enable javascript",
                "checking your browser",
                "captcha",
                "cloudflare"
            ]):
                return json.dumps({
                    "resolvable": False,
                    "genlayer_result": "UNRESOLVABLE",
                    "failure_reason": "content_anti_bot",
                    "status_code": 200,
                    "error_detail": "Anti-bot protection detected in page content",
                    "reasoning": ""
                })
            
            if any(pattern in content_lower for pattern in [
                "subscribe to continue",
                "subscription required",
                "paywall",
                "premium content",
                "sign in to read"
            ]):
                return json.dumps({
                    "resolvable": False,
                    "genlayer_result": "UNRESOLVABLE",
                    "failure_reason": "content_paywall",
                    "status_code": 200,
                    "error_detail": "Paywall detected - content not accessible",
                    "reasoning": ""
                })
            
            # === PHASE 3: LLM RESOLUTION ===
            try:
                prompt = f"""You are resolving a prediction market.

Question: {question}

Webpage content (from {normalized_url}):
{content_stripped[:8000]}

Based ONLY on the webpage content above, determine if this question resolved YES or NO.

Return JSON:
{{
  "answer": "YES" or "NO" or "UNRESOLVABLE",
  "reasoning": "Brief explanation of why, citing specific evidence from the page"
}}

If the content does not contain enough information to definitively answer the question, return "UNRESOLVABLE"."""
                
                llm_response = gl.nondet.exec_prompt(prompt, response_format='json')
            except Exception as e:
                return json.dumps({
                    "resolvable": False,
                    "genlayer_result": "UNRESOLVABLE",
                    "failure_reason": "llm_error",
                    "status_code": 200,
                    "error_detail": f"LLM execution failed: {str(e)[:150]}",
                    "reasoning": ""
                })
            
            # === PHASE 4: PARSE LLM RESPONSE ===
            if not isinstance(llm_response, dict):
                return json.dumps({
                    "resolvable": False,
                    "genlayer_result": "UNRESOLVABLE",
                    "failure_reason": "llm_invalid_response",
                    "status_code": 200,
                    "error_detail": "LLM did not return valid JSON object",
                    "reasoning": ""
                })
            
            answer = llm_response.get("answer", "")
            reasoning = llm_response.get("reasoning", "")
            
            if not answer:
                return json.dumps({
                    "resolvable": False,
                    "genlayer_result": "UNRESOLVABLE",
                    "failure_reason": "llm_no_answer",
                    "status_code": 200,
                    "error_detail": "LLM response missing 'answer' field",
                    "reasoning": reasoning
                })
            
            # Normalize answer
            answer = answer.upper().strip()
            if "YES" in answer:
                answer = "YES"
            elif "NO" in answer:
                answer = "NO"
            else:
                # LLM explicitly couldn't resolve
                return json.dumps({
                    "resolvable": False,
                    "genlayer_result": "UNRESOLVABLE",
                    "failure_reason": "llm_unresolvable",
                    "status_code": 200,
                    "error_detail": "LLM could not determine YES/NO from content",
                    "reasoning": reasoning
                })
            
            # === SUCCESS ===
            return json.dumps({
                "resolvable": True,
                "genlayer_result": answer,
                "failure_reason": "",
                "status_code": 200,
                "error_detail": "",
                "reasoning": reasoning
            })
        
        # === CONSENSUS ===
        result_json = gl.eq_principle.prompt_comparative(
            resolve_fn,
            principle="Results are equivalent if they have the same answer (YES/NO/UNRESOLVABLE) and the reasoning supports that answer"
        )
        
        result_data = json.loads(result_json)
        
        # Determine correctness
        genlayer_result = result_data.get("genlayer_result", "UNRESOLVABLE")
        resolvable = result_data.get("resolvable", False)
        
        # Normalize polymarket result for comparison
        poly_normalized = polymarket_result.upper().strip()
        correct = False
        if resolvable and genlayer_result in ["YES", "NO"]:
            correct = (genlayer_result == poly_normalized)
        
        market_result = MarketResult(
            market_id=market_id,
            question=question,
            resolution_url=normalized_url,
            polymarket_result=polymarket_result,
            resolvable=resolvable,
            genlayer_result=genlayer_result,
            correct=correct,
            failure_reason=result_data.get("failure_reason", ""),
            status_code=u256(result_data.get("status_code", 0)),
            error_detail=result_data.get("error_detail", ""),
            reasoning=result_data.get("reasoning", ""),
            timestamp=timestamp
        )
        
        self.results.append(market_result)
        return market_result.to_dict()

    @gl.public.view
    def get_results(self) -> list[dict]:
        """Get all resolved markets."""
        return [r.to_dict() for r in self.results]

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
