# GenLayer Market Resolver - Constructor-Only Pattern
# Deploy once, get result immediately. No method calls needed.
# Uses GenLayer v0.1.3+ API
import json
from genlayer import *


class MarketResolver(gl.Contract):
    """
    Resolution happens entirely in the constructor.
    
    Usage:
        1. Deploy with (market_id, question, resolution_url)
        2. Monitor deployment transaction
        3. Read `result` from deployed contract state
    
    No need to call any methods after deployment.
    """
    result: str  # JSON string with resolution outcome
    
    def __init__(self, market_id: str, question: str, resolution_url: str):
        """
        Fetches URL and resolves market question during deployment.
        
        Args:
            market_id: Unique identifier for the market
            question: The yes/no question to resolve
            resolution_url: URL containing resolution information
        """
        try:
            # Fetch webpage using GenLayer's non-deterministic web API
            # gl.nondet.web.render() handles JavaScript rendering
            page_content = gl.nondet.web.render(resolution_url, mode='text')
        except Exception as e:
            self.result = json.dumps({
                "market_id": market_id,
                "accessible": False,
                "error": str(e),
                "resolution": "URL_INACCESSIBLE"
            })
            return
        
        # Truncate content for LLM context window
        content_truncated = page_content[:6000]
        
        # Use equivalence principle for consensus
        def resolve():
            prompt = f"""Webpage content:
{content_truncated}

Question: {question}

Based ONLY on the webpage content above, determine the answer.
You must respond with exactly one word: YES, NO, or UNRESOLVABLE
"""
            return gl.nondet.exec_prompt(prompt).strip().upper()
        
        # Use comparative equivalence for soft matching
        resolution = gl.eq_principle.prompt_comparative(
            resolve,
            "Results are equivalent if they represent the same YES/NO/UNRESOLVABLE answer"
        )
        
        # Normalize response
        if "YES" in resolution:
            resolution = "YES"
        elif "NO" in resolution:
            resolution = "NO"
        else:
            resolution = "UNRESOLVABLE"
        
        self.result = json.dumps({
            "market_id": market_id,
            "accessible": True,
            "resolution": resolution
        })
    
    @gl.public.view
    def get_result(self) -> str:
        """Optional: retrieve stored result after deployment."""
        return self.result
