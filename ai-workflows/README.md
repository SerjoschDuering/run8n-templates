# AI Workflows Template

Pydantic-AI + pydantic-graph workflows for run8n stack.

## Status: Planning Phase

See [PLAN.md](./PLAN.md) for architecture decisions.

## Quick Start (Future)

```bash
pip install pydantic-ai pydantic-graph dbos
```

```python
from pydantic_ai import Agent
from pydantic_graph import BaseNode, End, Graph
import dbos

# Durable agent workflow
dbos.launch(database_url="postgresql://...@run8n_db:5432/agents")

@dbos.workflow()
async def my_workflow(query: str):
    agent = Agent("anthropic:claude-sonnet-4-20250514")
    return await agent.run(query)
```

## Structure (Planned)

```
ai-workflows/
├── PLAN.md           # Architecture decisions
├── README.md
├── requirements.txt
├── run8n_ai/         # Shared package
│   ├── agents/       # Reusable agents
│   ├── tools/        # Qdrant, PostgreSQL, etc.
│   └── graphs/       # Workflow definitions
└── examples/
    └── windmill/     # Example Windmill scripts
```
