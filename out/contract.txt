3:I[4707,[],""]
4:I[6423,[],""]
5:I[2972,["972","static/chunks/972-997644fce10d8ed5.js","185","static/chunks/app/layout-a31e498a2a532071.js"],""]
2:T371a,# { "Depends": "py-genlayer:latest" }
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
        result_json_str = gl.eq_principle.prompt_comparative(
            resolve_fn,
            principle="Results are equivalent if they have the same answer (YES/NO/UNRESOLVABLE) and the reasoning supports that answer"
        )
        
        # Parse result - handle both dict and string returns
        if isinstance(result_json_str, dict):
            result_data = result_json_str
        else:
            result_data = json.loads(result_json_str)
        
        # Determine correctness
        genlayer_result = result_data.get("genlayer_result", "UNRESOLVABLE")
        resolvable = result_data.get("resolvable", False)
        
        # Normalize BOTH for comparison (uppercase, strip whitespace)
        poly_normalized = polymarket_result.upper().strip()
        genlayer_normalized = genlayer_result.upper().strip()
        
        correct = False
        if resolvable and genlayer_normalized in ["YES", "NO"]:
            correct = (genlayer_normalized == poly_normalized)
        
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
0:["NHawL7C4WID5JN8IZ2b52",[[["",{"children":["contract",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],["",{"children":["contract",{"children":["__PAGE__",{},[["$L1",[["$","h1",null,{"style":{"fontSize":"2rem","marginBottom":"1rem"},"children":"Contract Code"}],["$","p",null,{"style":{"color":"#8b949e","marginBottom":"2rem"},"children":"PolymarketResolver Intelligent Contract"}],["$","div",null,{"className":"card","style":{"marginBottom":"2rem"},"children":[["$","h3",null,{"style":{"marginBottom":"1rem"},"children":"Contract Features"}],["$","ul",null,{"style":{"lineHeight":"1.8","color":"#8b949e"},"children":[["$","li",null,{"children":["📡 ",["$","strong",null,{"children":"Web Access:"}]," Fetches resolution URLs with error handling"]}],["$","li",null,{"children":["🤖 ",["$","strong",null,{"children":"LLM Resolution:"}]," Uses AI to determine YES/NO from content"]}],["$","li",null,{"children":["🔒 ",["$","strong",null,{"children":"Consensus:"}]," Multiple validators reach agreement"]}],["$","li",null,{"children":["📊 ",["$","strong",null,{"children":"Diagnostics:"}]," Tracks HTTP status, paywall detection, failure reasons"]}],["$","li",null,{"children":["✅ ",["$","strong",null,{"children":"Validation:"}]," Compares GenLayer result with Polymarket outcome"]}]]}]]}],["$","div",null,{"className":"card","children":["$","pre",null,{"style":{"maxHeight":"600px","overflow":"auto","margin":0},"children":["$","code",null,{"children":"$2"}]}]}]],null],null],null]},[null,["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","contract","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/5ab479793bdd2ea5.css","precedence":"next","crossOrigin":"$undefined"}]],["$","html",null,{"lang":"en","children":["$","body",null,{"children":[["$","nav",null,{"style":{"background":"#161b22","borderBottom":"1px solid #30363d","padding":"1rem 0","marginBottom":"2rem"},"children":["$","div",null,{"className":"container","style":{"display":"flex","justifyContent":"space-between","alignItems":"center","flexWrap":"wrap","gap":"1rem"},"children":[["$","$L5",null,{"href":"/","style":{"fontSize":"1.5rem","fontWeight":"bold","color":"#58a6ff","textDecoration":"none"},"children":"🔬 GenLayer Benchmark"}],["$","div",null,{"style":{"display":"flex","gap":"2rem","alignItems":"center"},"children":[["$","$L5",null,{"href":"/markets","children":"Markets"}],["$","$L5",null,{"href":"/contract","children":"Contract"}],["$","$L5",null,{"href":"/results","children":"Results"}]]}]]}]}],["$","main",null,{"className":"container","style":{"paddingBottom":"4rem"},"children":["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":"404"}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],"notFoundStyles":[]}]}],["$","footer",null,{"style":{"textAlign":"center","padding":"2rem 0","color":"#8b949e","fontSize":"0.9rem","borderTop":"1px solid #30363d","marginTop":"4rem"},"children":["$","div",null,{"className":"container","children":[["$","div",null,{"children":["Contract: ",["$","code",null,{"children":"0x1414F437fd85Ed7f713756c28b2f03F73A3Dc905"}]]}],["$","div",null,{"style":{"marginTop":"0.5rem"},"children":"GenLayer Studionet"}]]}]}]]}]}]],null],null],["$L6",null]]]]
6:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"GenLayer Benchmark"}],["$","meta","3",{"name":"description","content":"Polymarket resolution via GenLayer Intelligent Contracts"}]]
1:null
