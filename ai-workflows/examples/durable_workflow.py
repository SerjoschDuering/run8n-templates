"""
Durable workflow with DBOS - survives crashes.
Requires DBOS setup with PostgreSQL.
"""
import os
import dbos
from pydantic_ai import Agent
from dataclasses import dataclass

# Initialize DBOS with your PostgreSQL
# In Windmill, set DATABASE_URL as a resource/variable
dbos.launch(database_url=os.environ.get("DATABASE_URL"))

@dataclass
class ResearchResult:
    query: str
    research: str
    summary: str

@dbos.step()
async def do_research(query: str) -> str:
    """Step 1: Research (checkpointed)"""
    agent = Agent("anthropic:claude-sonnet-4-20250514",
                  system_prompt="Research the topic thoroughly.")
    result = await agent.run(query)
    return result.data

@dbos.step()
async def summarize(research: str) -> str:
    """Step 2: Summarize (checkpointed)"""
    agent = Agent("anthropic:claude-sonnet-4-20250514",
                  system_prompt="Summarize in 2-3 sentences.")
    result = await agent.run(f"Summarize: {research}")
    return result.data

@dbos.workflow()
async def main(query: str) -> dict:
    """
    Durable research workflow.
    If this crashes after step 1, it resumes at step 2.
    """
    research = await do_research(query)    # Checkpoint 1
    summary = await summarize(research)     # Checkpoint 2

    return {
        "query": query,
        "research": research,
        "summary": summary
    }
