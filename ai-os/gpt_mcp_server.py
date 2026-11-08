"""MCP server that gives Claude Code an `ask_chatgpt` tool.

Claude Code starts this automatically (see .mcp.json). Inside Claude Code you
can then say: "ask ChatGPT for a second opinion on this plan".
"""
from mcp.server.mcpserver import MCPServer

from aios.core import ask_gpt

mcp = MCPServer("chatgpt")


@mcp.tool()
def ask_chatgpt(question: str, role: str = "second-opinion reviewer") -> str:
    """Ask the OpenAI model (ChatGPT's API) a question. It already sees the shared
    AI-OS context files. Use for strategy, research angles, or an independent
    critique of Claude's own work. Costs API credits: don't call it in loops."""
    try:
        return ask_gpt(question, role=role)
    except Exception as e:  # return errors to Claude instead of crashing the server
        return f"ERROR: {e}"


if __name__ == "__main__":
    mcp.run()
