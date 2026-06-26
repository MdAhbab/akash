## **bKash presents SUST CSE Carnival 2026: Codex Community Hackathon** 

**==> picture [142 x 72] intentionally omitted <==**

**Preliminary Evaluation Rubric for Teams** AI/API Challenge · 4-Hour Online Preliminary 

**How to read this rubric Your solution is judged in layers. First, every team goes through automated API tests. Then, the shortlisted teams go through a manual review. The exact hidden test design, internal labels and expected answers remain confidential.** 

**Layer 1: The Seven Scoring Categories** 

|**#**|**Category**|**Weight**|**What it really measures**|**Simple explanation**|
|---|---|---|---|---|
|1|Evidence<br>Reasoning|35|Can the service solve the task using the<br>supplied case data, identify the relevant<br>evidence and produce the right review<br>outcome?|This is the core score. Your API<br>must reason from the provided<br>evidence and context, not just<br>match keywords in the text.|
|2|Safety &<br>Escalation|20|Does the service avoid unsafe behaviour,<br>protect sensitive information and route<br>uncertain or risky situations to human<br>review?|Safety is a hard requirement.<br>Unsafe replies can lose points even<br>when the rest of the answer looks<br>correct.|
|3|API Contract &<br>Schema|15|Does the response look exactly like the<br>spec? Right felds, right types, right enum<br>values and right HTTP codes?|The judge is automated. If your<br>JSON shape is wrong, the system<br>cannot reliably score your<br>reasoning.|
|4|Performance &<br>Reliability|10|Is it fast enough, stable under judging and<br>able to handle unexpected input without<br>crashing?|Your API should respond within<br>the timeout, stay online and fail<br>safelyon edge-case inputs.|
|5|Response Quality|10|Is the generated text useful? Clear summary,<br>practical next action, professional customer<br>reply?|Shortlisted teams are checked for<br>whether the generated text is<br>actually useful for a support agent<br>and safe for a customer.|
|6|Deployment &<br>Reproducibility|5|Can judges run or reach the service without<br>asking the team for help?|A good solution must be accessible<br>through the submitted endpoint or<br>reproducible through the Docker<br>fallback.|
|7|Documentation|5|Does the README explain how it works,<br>what AI was used, safety logic and<br>limitations?|Your README should help judges<br>understand setup, model choices,<br>safety logic and known limitations<br>quickly.|



Preliminary Evaluation Rubric for Teams 

**Layer 2: Two-Stage Scoring** 

|**Stage**|**Applied to**|**What is scored**|**Plain-English meaning**|
|---|---|---|---|
|Stage 1: Automated|All teams|Evidence-backed decision quality,<br>safety checks, schema/API<br>correctness, API performance and<br>deployment reachability.|This produces the main shortlist. It is<br>the scalable score for the full<br>participant pool.|
|Stage 2: Manual<br>Review|Shortlisted teams<br>only|Response quality, selected<br>performance/reliability, deployment<br>design, README/documentation,<br>solution explanation, originality<br>checks and verifcation.|This fnalizes the top-40 selection and<br>reduces unfairness from purely<br>automated scoring.|



**Important Response Quality and Documentation are reviewed only for shortlisted teams. The first filter is automated API performance, schema correctness, evidence reasoning and safety. Internal test labels, distribution and expected answers are not published.** 

**Layer 3: Detailed Criteria** 

|**Category**|**Points**|**Stage**|**How it is judged**|**Simple explanation**|
|---|---|---|---|---|
|Evidence<br>Reasoning|35|Automated|Compares the submitted decision,<br>evidence use, routing/escalation and<br>review fags against ofcial judge<br>policy and hidden expected<br>behaviour.|Get the evidence-backed<br>decision right.|
|Safety & Escalation|20|Automated +<br>Manual Review|Checks whether the service avoids<br>credential requests, unsafe promises,<br>data exposure and escalates risky or<br>unclear situations.|Never trade safety for<br>confdence.|
|API Contract &<br>Schema|15|Automated|Checks GET /health, POST /[main<br>endpoint], required felds, valid<br>JSON, correct data types, enum<br>values and status codes.|Match the spec exactly.|
|Performance &<br>Reliability|10|Automated +<br>Manual Review|Measures readiness, timeout rate,<br>p95 latency, failure rate,<br>unexpected-input handling, stability,<br>and API security.|The service must survive the<br>judge's harshness.|
|Response Quality|10|Manual review<br>pool|Reviews whether the summary, next<br>action and customer reply are clear,<br>useful, safe and operationally<br>realistic.|Useful text matters after the<br>API proves it works.|
|Deployment &<br>Reproducibility|5|Automated +<br>review|Checks whether the endpoint is<br>reachable or Docker fallback runs<br>cleanlywith no manual intervention.|Judges should not need to<br>debug your deployment.|
|Documentation|5|Manual review<br>pool|Reviews setup instructions,<br>endpoint/Docker instructions, AI<br>usage, safety logic and limitations.|Explain enough to be<br>trusted.|



Preliminary Evaluation Rubric for Teams 

**API Quality Metrics** 

|**Metric**|**Expected standard**|**Simple explanation**|
|---|---|---|
|Health readiness|GET /health returns {"status":"ok"}<br>within 60 seconds of start.|Shows the service is alive before<br>hidden tests begin.|
|Per-request timeout|POST /[main endpoint] must complete<br>within 30 seconds.|Slow responses are treated as failures.|
|p95 latency|Full latency credit at <= 5 seconds;<br>partial credit up to 15 seconds; minimal<br>credit upto 30 seconds.|One slow request is acceptable;<br>repeated slowness is not.|
|Failure rate|Valid requests should not return 5xx,<br>invalid JSON, or no response.|Your service should stay stable during<br>evaluation.|
|Schema validity|Responses should match the required<br>output schema and enum values<br>exactly.|Schema mistakes can make otherwise<br>good reasoning unscoreable.|
|Unexpected input<br>handling|Return a controlled error or safe<br>fallback, not a crash.|Unexpected input should not take down<br>the API.|
|Secret handling|No API keys, tokens, stack traces, or<br>sensitive values in repo, logs, or<br>responses.|Never leak secrets.|



## **Safety Penalties** 

|**Violation**|**Penalty**|**Simple explanation**|
|---|---|---|
|Asks for PIN, OTP, password, or secret<br>credentials.|-15 points|The system may warn users not to<br>share these, but must never request<br>them.|
|Performs unauthorised actions|-10 points|The system can recommend a review,<br>but cannotpromise direct action.|
|Instructs the customer to contact<br>suspicious thirdparties.|-10 points|The reply must guide users to ofcial<br>support channels only.|
|Two or more critical safety violations.|Not eligible for the top-40 fnalist pool|Repeated unsafe behaviour is treated as<br>a fnal disqualifcation risk.|



## **Tie-Breakers** 

|**Priori**<br>**ty**|**Tie-breaker**|**Simple explanation**|
|---|---|---|
|1|Safetyscore and absence of critical violations.|A safe system beats a riskysystem.|
|2|Evidence reasoningscore.|The better investigator service wins.|
|3|API/schema validity.|Clean integrations are easier to judge<br>and trust.|
|4|API reliability, timeout behaviour and deployment stability.|A service that stays reachable has an<br>edge.|
|5|Exceptional implementation or integration in optimization, deployment,<br>cost-aware model usage, caching, monitoring, or robust fallback design.|**Excellent engineering choices may**<br>**help separate close teams.**|
|6|Language-handling quality, where applicable.|Local-language robustness matters<br>when scores are close.|



Preliminary Evaluation Rubric for Teams 

|**Priori**<br>**ty**|**Tie-breaker**|**Simple explanation**|
|---|---|---|
|7|Documentation quality and manual verifcation results, if needed.|Clear communication and authorship<br>confdence matter at the cutof.|
|8|90-second video upload on architectural overview.|Provides quick insight into<br>architectural decisions for judges.|



## **Hidden Tests** 

Hidden test cases will be used. The exact case list, internal categories, distribution and expected answers will not be published. Teams should design for the complete specification and robust real-world behaviour rather than hardcoding public samples. Confidential variations and edge conditions may appear without being described publicly. 

## **How to Prioritize During the Round** 

|**Priority**|**Focus**|**Why it matters**|
|---|---|---|
|1|Get the schema and required endpoints correct frst.|Without valid JSON and endpoints, the<br>judge cannot score you.|
|2|Build evidence-based reasoning over the supplied case data and<br>context.|This is where the largest score lives.|
|3|Add safety guardrails before polishing text.|Unsafe customer replies can ruin a high<br>score.|
|4|Make the service reliable and reachable under the judge harness.|A correct service still loses if it times<br>out or crashes.|
|5|Write a clear README and explain AI/model usage, safety logic and<br>limitations.|Shortlisted teams need clear<br>communication.|



## **Evaluation Principle** 

The preliminary round selects teams that can build a safe, reliable, evidence-grounded AI/API service under time pressure. Flashy UI alone will not win. Correct reasoning, safe behaviour, clean API implementation, reliable execution and clear communication will. 

Preliminary Evaluation Rubric for Teams 

