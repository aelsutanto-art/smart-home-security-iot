# Smart home IoT security and queue based scaling

SIT314 Distinction and High Distinction project source for tutor review.

Simulated sensors publish events through MQTT. A local bridge forwards events to Amazon SQS, and AWS ECS/Fargate workers apply security rules and send decisions to a results queue. The HD extension adds a custom queue-driven scaling controller and repeatable workloads.

## Code to review

| Folder | Contents |
| --- | --- |
| `distinction/` | Sensor simulators, MQTT-to-SQS bridge, processor, 200-event load test and deployment template for the D project |
| `high-distinction/` | Automatic controller, scaling policy, instrumented processor, deterministic load generator, bridge and six offline tests |
| `docs/` | Experiment summary and source provenance |

Start with `high-distinction/hd_policy.js`, `hd_controller.js` and `processor.js`. The policy scales from one to three workers after sustained backlog, and back to one after a sustained empty queue. It is a custom controller calling ECS APIs, not AWS managed Service Auto Scaling.

JavaScript, dependency files and Dockerfiles are unchanged from the submission archives. Lab account numbers in task-definition templates are replaced with `ACCOUNT_ID`; these templates must be adapted before deployment. See `docs/source-manifest.json` for file hashes and changes. The README files were prepared for this code release. The earlier Node-RED prototype flow export is not included in the archived source; this repository contains the final cloud implementations.

## Run the offline tests

Install Node.js 22, open a terminal in `high-distinction`, and run:

```powershell
node --test hd_policy.test.js hd_processor.test.js
```

The six tests use Node built-ins and mocks. They do not need AWS credentials or start cloud resources. Use this command rather than `npm test`, which remains the original package placeholder.

## Set up an integration run

In the implementation folder you want to use:

```powershell
npm ci
Copy-Item .env.example .env
```

Fill in your own queue URLs and AWS profile locally. The HD controller explicitly uses the `school-lab` profile and `us-east-1` in `hd_common.js`, and the cluster/service names in `hd_controller.js`. Changing `AWS_PROFILE` alone does not override those controller settings. The AWS SDK components use their normal credential chain; Fargate uses a task role. Do not commit credentials or real `.env` files.

Cloud execution needs an ECR repository, two SQS queues, a CloudWatch log group, suitable IAM roles, and an ECS Fargate service with outbound connectivity. Resource creation is not automated by this repository. Adapt the task definition, image URI, roles and networking to your account. Build the Docker image in the relevant implementation folder; the Dockerfile packages that folder's processor.

The MQTT broker is public and unencrypted. Use synthetic data only. The D scripts share a hard-coded topic prefix; change it consistently across bridge and publishers for a separate environment. HD uses `HD_MQTT_TOPIC`; configure a unique topic. Avoid running the D wildcard bridge alongside HD experiments.

## Experiment procedure

See the README in each implementation folder and `docs/results.md`. Only run cloud commands in your own prepared lab environment. Starting adaptive mode changes the service's desired task count. Stopping the controller does not stop the workers; explicitly scale the service to zero after testing.

The submitted reports and full original evidence remain in the assessment submission. This code repository provides the implementations and a compact results summary.
