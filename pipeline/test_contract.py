# { "Depends": "py-genlayer:latest" }
from genlayer import *


class TestContract(gl.Contract):
    value: int

    def __init__(self):
        self.value = 42

    @gl.public.view
    def get_value(self) -> int:
        return self.value

    @gl.public.write
    def set_value(self, new_value: int) -> None:
        self.value = new_value
