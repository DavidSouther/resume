# FCC Refactor review 2

## Jiffies 2026.26.1

The prior updates are in there, so jiffies.ts can get removed, we can drop all calls to `setAttr` and `a`, and just use Jiffies directly.

## controls.ts, dials.ts

State and Markup are intertwined. `bindRange`, `bindCheck` are going obtusely out of their way. Extract common components. `ControlHandles` is a global reference to all items, which is not what FCCs are about. You've tried and failed three times now to get it right, do some deeeeeep thinking about data separation and component isolation in reactive frameworks before you try this again. What do you need from me to better guide you here?


## components.ts

Zodiac can probably be a single array return, the individual consts aren't reused anywhere.
