# Interaction & Testing (`orchestrate chat`)
Launch the Web Chat UI or conduct text-based chat tests.

* **`start`**: Run the chat interface service (hosted at `http://localhost:3000/chat-lite`).
  * *Options*:
    * `-e`, `--env-file` (str): Override settings.
    * `--skip-open` (bool): Avoid opening chat UI automatically in web browser.
  * *Usage*: `orchestrate chat start --skip-open`
* **`stop`**: Stop the chat interface service.
  * *Usage*: `orchestrate chat stop`
* **`ask`**: Chat with an agent in interactive console mode or send a single prompt.
  * *Arguments*: `message` (str): Single message to evaluate (optional).
  * *Options*:
    * `-n`, `--agent-name` (str, required): Target agent name.
    * `-r`, `--include-reasoning` (bool): Display execution thoughts/agent reasoning.
    * `-l`, `--capture-logs` (bool): Print container logs inline (custom agents only).
    * `-t`, `--thread-id` (str): Resume conversation thread.
  * *Usage*: `orchestrate chat ask --agent-name calc_agent "What is 2 + 2?" --include-reasoning`


# Observability Traces (`orchestrate observability`)
Search and download execution traces. Useful for debugging tool actions.

* **`traces search`**: Locate trace IDs matching criteria.
  * *Options*:
    * `--start-time` / `--end-time` (ISO 8601 strings).
    * `--last` (str): Time window shorthand (`30m`, `3h`, `10d`, `30 minutes`, etc.). *Mutually exclusive with start/end parameters.*
    * `-s`, `--service-name` (str): Repeated service names.
    * `-i`, `--agent-id` (str): Repeated agent IDs.
    * `-a`, `--agent-name` (str): Repeated agent names.
    * `-u`, `--user-id` (str): Repeated user IDs.
    * `--limit` (int): Number of trace logs. Max 1000.
  * *Usage*: `orchestrate observability traces search --last 3h --agent-name helper_agent`
* **`traces export`**: Retrieve span records for a trace.
  * *Options*:
    * `-t`, `--trace-id` (str, required): 32-character hexadecimal trace ID.
    * `-o`, `--output` (str): Save JSON output directly to file path.
    * `--pretty/--no-pretty` (bool): Formatted print.
  * *Usage*: `orchestrate observability traces export --trace-id 1234567890abcdef1234567890abcdef --output trace.json`


# Agent Evaluation (`orchestrate evaluations`)
Run tests, generate test configurations, or execute red-teaming checks.

* **`evaluate`**: Execute test suits.
  * *Options*:
    * `-c`, `--config` (str): Path to configuration YAML.
    * `-p`, `--test-paths` (str): Comma-separated paths to test files/folders.
    * `-o`, `--output-dir` (str): Target results output folder.
    * `-e`, `--env-file` (str): Overriding `.env` path.
    * `-l`, `--with-langfuse` (bool): Save trace details to Langfuse.
  * *Usage*: `orchestrate evaluations evaluate --test-paths ./tests --output-dir ./results`
* **`quick-eval`**: Evaluate metrics referenceless (LLM-as-a-judge).
  * *Options*: `--test-paths`, `--tools-path`, `--output-dir`, `--config`.
  * *Usage*: `orchestrate evaluations quick-eval --test-paths ./tests --tools-path ./tools --output-dir ./results`
* **`record`**: Record live chat sessions to automatically construct evaluation tests.
  * *Usage*: `orchestrate evaluations record --output-dir ./new_tests`
* **`generate`**: Create test cases from user stories.
  * *Options*: `--stories-path` (CSV), `--tools-path` (directory), `--output-dir`.
  * *Usage*: `orchestrate evaluations generate --stories-path stories.csv --tools-path ./tools --output-dir ./tests`
* **`analyze`**: Read and analyze test results.
  * *Options*: `--data-path` (directory containing results), `--tools-path`, `--mode` (`default` or `enhanced`).
  * *Usage*: `orchestrate evaluations analyze --data-path ./results`
* **`validate-external`**: Validate schema specifications and perform integration checks for an external agent.
  * *Options*: `--tsv`, `--external-agent-config`, `--credential`, `--output`, `--perf`.
  * *Usage*: `orchestrate evaluations validate-external --tsv inputs.tsv --external-agent-config agent.json --credential token123 --output ./validation`
* **`validate-native`**: Evaluate native agent outputs.
  * *Usage*: `orchestrate evaluations validate-native --tsv inputs.tsv --output ./validation`

## Red-Teaming Attacks (`orchestrate evaluations red-teaming`)
* **`list`**: List all available red-teaming attack plans.
* **`plan`**: Create attack scenarios against an agent.
  * *Options*: `--attacks-list`, `--datasets-path`, `--agents-path`, `--target-agent-name`, `--output-dir`, `--max_variants`.
  * *Usage*: `orchestrate evaluations red-teaming plan -a prompt_injection -d dataset.json -g ./agents -t helper_agent -o ./attacks`
* **`run`**: Execute red-teaming plans.
  * *Options*: `--attack-paths` (comma-separated), `--output-dir`.
  * *Usage*: `orchestrate evaluations red-teaming run --attack-paths ./attacks -o ./attack_results`