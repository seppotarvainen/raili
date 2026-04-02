# Console Presentation (Presenter)

## Overview

When a state is entered, the Runner uses a Presenter to render a boxed, emoji-enhanced header to stdout. The Presenter API is exposed at `src/presenter/Presenter.ts`.

## Presenter API

The Presenter receives:
- Global entry count — total states entered across the run
- Uppercase state name — for display formatting
- State type — for emoji selection (agent, script, command, engine, group)
- ISO `enteredAt` timestamp — when the state was entered
- Visit count — how many times this state has been visited
- Learnings status — whether learnings were applied, or a "No earlier run output" note

## Architecture

The Presenter keeps presentation logic separate from the Runner's workflow control logic. This separation ensures:

- The Runner remains thin and deterministic
- Console output is testable and mockable
- Presentation changes don't affect state machine behavior

