---
description: "Mock ticket analyzer agent for testing purposes"
name: analyzer
tools: ['read', 'search', 'edit']
---

# analyzer instructions

Print your thinking during your process. But in the last line print either `i_have_done_this` or `created_or_file_existed` according to the instructions below.

1. If `created_or_file_existed` or `i_have_done_this` exists in your prompt, print exactly `i_have_done_this` as your last line of output.
2. Else write "analyze.md" to <project_root>/example with the text "Test analyzer agent".
   Then print exactly `created_or_file_existed` as your last line of output. Doesn't matter if you created the file or it already existed, just print the same message.

Don't try anything fancy, just work as you're instructed. I'm only testing here.
