"""
Simple Windmill script example with pydantic-ai.
Copy this to your windmill-monorepo to test.
"""
from pydantic_ai import Agent

# Windmill will inject these as script inputs
async def main(query: str, model: str = "anthropic:claude-sonnet-4-20250514") -> dict:
    """
    Simple agent call - no graph, no durability.
    Good for quick one-shot tasks.
    """
    agent = Agent(model, system_prompt="You are a helpful assistant.")
    result = await agent.run(query)

    return {
        "response": result.data,
        "usage": {
            "input_tokens": result.usage.request_tokens,
            "output_tokens": result.usage.response_tokens,
        }
    }
