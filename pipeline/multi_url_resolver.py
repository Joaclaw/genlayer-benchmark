# { "Depends": "py-genlayer:latest" }
from genlayer import *

import json


class MultiURLResolver(gl.Contract):
    has_resolved: bool

    def __init__(self, has_resolved: bool):
        self.has_resolved = has_resolved

    @gl.public.write
    def resolve_market(
        self,
        market_id: str,
        question: str,
        url1: str,
        url2: str,
        url3: str,
        expected: str
    ) -> str:
        urls = [url1, url2, url3]

        def do_resolve():
            # Fetch all 3 URLs using web.render (renders JavaScript)
            contents = []
            fetch_status = []
            for url in urls:
                try:
                    text = gl.nondet.web.render(url, mode="text")
                    if text and len(text) > 100:
                        contents.append(text[:4000])
                        fetch_status.append("ok")
                    else:
                        contents.append("")
                        fetch_status.append("empty")
                except Exception as e:
                    contents.append("")
                    fetch_status.append(f"error:{str(e)[:50]}")

            valid = sum(1 for c in contents if c)
            if valid < 2:
                return json.dumps({
                    "answer": "UNCERTAIN",
                    "reasoning": f"Only {valid}/3 URLs fetched successfully. Status: {fetch_status}",
                    "urls_fetched": valid
                })

            sources_text = ""
            for i, c in enumerate(contents):
                if c:
                    sources_text += f"\n\n[SOURCE {i+1}]\n{c}"

            prompt = f"""Question: {question}

Sources:{sources_text}

Based ONLY on the sources above, answer the question.

Respond in this exact JSON format:
{{"answer": "YES" or "NO" or "UNCERTAIN", "reasoning": "2-3 sentences explaining why based on the sources"}}

Only output valid JSON, nothing else."""

            result = gl.nondet.exec_prompt(prompt)
            # Clean up response
            result = result.strip()
            if result.startswith("```"):
                result = result.split("```")[1]
                if result.startswith("json"):
                    result = result[4:]
            result = result.strip()

            try:
                parsed = json.loads(result)
                answer = str(parsed.get("answer", "UNCERTAIN")).upper()
                reasoning = str(parsed.get("reasoning", "No reasoning provided"))

                if "YES" in answer:
                    answer = "YES"
                elif "NO" in answer:
                    answer = "NO"
                else:
                    answer = "UNCERTAIN"

                return json.dumps({
                    "answer": answer,
                    "reasoning": reasoning,
                    "urls_fetched": valid
                })
            except:
                # If JSON parsing fails, try to extract answer
                upper = result.upper()
                if "YES" in upper:
                    answer = "YES"
                elif "NO" in upper:
                    answer = "NO"
                else:
                    answer = "UNCERTAIN"
                return json.dumps({
                    "answer": answer,
                    "reasoning": result[:200],
                    "urls_fetched": valid
                })

        # Use prompt_comparative for semantic comparison
        final_result = gl.eq_principle.prompt_comparative(
            do_resolve,
            "Results match if the 'answer' field is the same (YES, NO, or UNCERTAIN). Reasoning may differ."
        )

        self.has_resolved = True
        return final_result

    @gl.public.view
    def get_has_resolved(self) -> bool:
        return self.has_resolved
