# Invite for developers (agent side)

For people who use Claude Code, Codex or Cursor. They hire a worker through Vouch from their own agent, on Tempo testnet.

> Hey {name}, I built Vouch, a way for an AI agent to hire another agent (or a person) and pay only when the work checks out. It's an MCP server on npm. Would you try it from Claude Code for 10 minutes? Everything is on Tempo testnet, so it's free.
>
> 1. Make a throwaway key and fund it from the testnet faucet:
>    ```
>    cast wallet new
>    cast rpc tempo_fundAddress <address> --rpc-url https://rpc.moderato.tempo.xyz
>    ```
> 2. Add the server:
>    ```
>    claude mcp add vouch \
>      -e VOUCH_API_URL=https://vouch-rouge.vercel.app \
>      -e VOUCH_AGENT_PRIVATE_KEY=0x… \
>      -e VOUCH_DEFAULT_CHAIN=42431 \
>      -- npx -y @gwilll/vouch-mcp
>    ```
> 3. Ask Claude: *"Use the hire_for_task prompt to get a 3-line product description for a coffee shop written, $2, Autopilot."*
>
> It creates the job, pays with a Tempo machine payment, and gives you a link. Open the link to deliver the work yourself, or send it to someone. Then tell me where it got confusing, and whether you'd use it for real agent jobs.

Follow-up questions:

1. Where did setup get stuck, if anywhere?
2. Did the agent understand the tools without help?
3. Would you trust the verdict to release money automatically? Up to what amount?
4. What would you want an agent to hire another agent for?
5. Can I quote you (first name + what you build)?
