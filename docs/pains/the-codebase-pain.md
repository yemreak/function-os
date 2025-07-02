# The Codebase Pain

You want to understand how login works but instead you're opening seven files following a trail from route to middleware to service to repository to model and by the time you reach the actual logic you've forgotten why you started this journey because modern codebases scatter functions across files like hiding conversations in different rooms of a building.

The tools mock your need by showing you everything except what you want because when you search for a function they show you imports and comments and type definitions but not the actual function body and when you finally find it you realize it calls three other functions in three other files so the dance begins again.

Functions are the atoms of logic but tools treat files as citizens forcing you to think "which file contains this function" instead of "what does this function do" which is like trying to understand a conversation by first finding which room it happened in rather than just hearing what was said.

For AI agents the pain multiplies because they can't skim or guess so they read ten thousand tokens of boilerplate to find five hundred tokens of logic buried in layers of organization that serves compilers not comprehension turning minutes into hours and questions into odysseys.

We organize code for machines to execute but need to read it with minds that think in logic not locations yet we've spent decades building tools that perpetuate this mismatch treating the symptom while the disease of file-centric thinking spreads deeper into every codebase making mazes out of what should be maps.