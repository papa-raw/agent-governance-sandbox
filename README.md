# Agent Governance Sandbox

A geoprospective governance simulator where communities delegate political authority to AI agents and watch what happens to their shared territory.

**Hackathon**: PL_Genesis: Frontiers of Collaboration (deadline March 16, 2026)

## Demo Region: Camargue, France

The simulation models the Camargue Rhone delta — a UNESCO Biosphere Reserve where rice farmers, salt producers, conservationists, hunters, and tourism developers compete for shared water and land resources under different governance configurations.

### Five AI Agent Delegates

| Agent | Stakeholder | Personality | Role |
|-------|------------|-------------|------|
| Tour du Valat | Conservationist | Cooperator | Protects wetlands, lagoons, Natura 2000 areas |
| Riziculteurs du Delta | Rice Farmer | Whale | Dominates water allocation for irrigation |
| Salins du Midi | Salt Producer | Strategic | Manages salt ponds, negotiates water balance |
| Chasseurs de Camargue | Hunter | Free-rider | Extracts from marshland without contributing |
| Saintes-Maries Tourisme | Tourism Dev | Chaotic | Unpredictable coastal development pressure |

### Three Governance Presets

- **Tragedy of the Commons** — No rules, open access, pure self-interest
- **Ostrom Commons** — Boundary rules, contribution requirements, graduated sanctions, collective choice with threshold disclosure voting
- **Plutocratic Governance** — Stake-weighted voting, no contribution requirements

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

### Enable LLM Agent Delegates

By default, agents use deterministic personality-based behavior. To enable Claude-powered decision-making:

```bash
cp .env.example .env
# Add your Anthropic API key to .env
```

## Architecture

```
src/
  engine/
    simulation.ts       # Core round loop: validate → apply → enforce → regenerate → detect
    territory.ts        # GeoJSON → Territory with density-dependent regeneration
    agents.ts           # 5 Camargue stakeholder agent factory
    governance/
      presets.ts        # 3 governance configuration presets
    mechanisms/
      validation.ts     # Action validation against governance rules
      effects.ts        # Action application to agents and territory
      enforcement.ts    # Contribution checks, graduated sanctions
      regeneration.ts   # Density-dependent territory regeneration (Janssen spatial commons)
      failure-modes.ts  # 8 failure mode detectors with continuous severity
      replicator.ts     # Replicator dynamics cooperation prediction
    llm/
      client.ts         # Anthropic SDK wrapper
      prompts.ts        # Per-agent system prompts from delegation configs
      runtime.ts        # LLM action generation with Zod validation + deterministic fallback
  components/
    TerritoryMap.tsx    # MapLibre map with zone health overlay
    AgentPanel.tsx      # Agent delegate cards with stats
    GovernanceTimeline.tsx  # Event timeline + failure mode indicators
    SimulationControls.tsx  # Config selector + control buttons
  data/
    camargue.json       # 19-zone GeoJSON (placeholder — real data from data.gouv.fr)
  types.ts              # Full type system with Zod schemas
```

## Key Concepts

- **Geoprospective governance**: French territorial management discipline — participatory spatial simulation for governance foresight
- **Simocratic governance**: AI agents as democratic delegates acting on behalf of real people's configured values
- **Configure, Delegate, Walk Away, Review, Adjust**: Core user interaction cycle
- **Ostrom's 8 design principles**: Commons governance framework implemented as composable mechanisms
- **Replicator dynamics**: Evolutionary game theory predicting cooperation/defection equilibria
- **Density-dependent regeneration**: Zone health affected by neighbor health (Janssen spatial commons model)
- **Failure mode detection**: 8 failure modes with continuous severity scores and cascade relationships

## Tech Stack

- React 19 + TypeScript + Vite
- MapLibre GL + react-map-gl (OpenFreeMap tiles, no API key needed)
- Tailwind CSS + CSS custom properties (dark theme design system)
- react-resizable-panels (dashboard layout)
- Zod (LLM output validation)
- Anthropic SDK (Claude Haiku 4.5 for agent delegates)

## License

MIT
