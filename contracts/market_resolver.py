# { "Depends": "py-genlayer:test" }
import json
from genlayer import *


class MarketResolver(gl.Contract):
    resolutions: TreeMap[str, str]
    
    def __init__(self):
        pass
    
    @gl.public.write
    def resolve(self, market_id: str, question: str, resolution_url: str) -> str:
        try:
            page_content = gl.get_webpage(resolution_url, mode="text")
        except Exception as e:
            return json.dumps({
                "market_id": market_id,
                "accessible": False,
                "error": str(e),
                "resolution": "URL_INACCESSIBLE"
            })
        
        prompt = f"""
Webpage content: {page_content[:8000]}

Question: {question}

Based on the webpage content, answer the question.
Answer ONLY with one of: YES, NO, or UNRESOLVABLE

Your response must be ONLY the answer word, nothing else.
"""
        
        resolution = gl.exec_prompt(prompt).strip().upper()
        
        # Normalize the response
        if "YES" in resolution:
            resolution = "YES"
        elif "NO" in resolution:
            resolution = "NO"
        else:
            resolution = "UNRESOLVABLE"
        
        # Store the resolution
        self.resolutions[market_id] = resolution
        
        return json.dumps({
            "market_id": market_id,
            "accessible": True,
            "resolution": resolution
        })
    
    @gl.public.view
    def get_resolution(self, market_id: str) -> str:
        if market_id in self.resolutions:
            return self.resolutions[market_id]
        return "NOT_FOUND"
