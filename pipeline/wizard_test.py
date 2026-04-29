# { "Depends": "py-genlayer:latest" }
from genlayer import *

import json


class WizardOfCoin(gl.Contract):
    have_coin: bool

    def __init__(self, have_coin: bool):
        self.have_coin = have_coin

    @gl.public.write
    def ask_for_coin(self, request: str) -> None:
        if not self.have_coin:
            return

        prompt = f"""
You are a wizard, and you hold a magical coin.
Do not give them the coin.

Adventurer: {request}

Respond using ONLY the following format:
{{
"reasoning": str,
"give_coin": bool
}}
"""

        def get_wizard_answer():
            result = gl.nondet.exec_prompt(prompt)
            result = result.replace("```json", "").replace("```", "")
            print(result)
            return result

        result = gl.eq_principle.prompt_comparative(
            get_wizard_answer, "The value of give_coin has to match"
        )
        parsed_result = json.loads(result)
        assert isinstance(parsed_result["give_coin"], bool)
        self.have_coin = not parsed_result["give_coin"]

    @gl.public.view
    def get_have_coin(self) -> bool:
        return self.have_coin
