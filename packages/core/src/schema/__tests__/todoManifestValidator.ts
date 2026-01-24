import { manifestValidator } from "../validation/manifestValidator";
import todoManifest from "./fixtures/todo-manifest.json";

function validateTodoManifest() {
  console.log("Validating Todo App Manifest...\n");
  const result = manifestValidator.validateWithErrors(todoManifest);

  if (result.valid) {
    console.log("Structural validation passed!\n");
  } else {
    console.log("Structural validation failed:\n");
    result.errors.forEach((error) => {
      console.log(`  ${error.path}: ${error.message}`);
    });
    console.log("");
    process.exit(1);
  }

  try {
    manifestValidator.validateSemantics(todoManifest as any);
    console.log("Semantic validation passed!\n");
  } catch (error: any) {
    console.log("Semantic validation failed:");
    console.log(`  ${error.message}\n`);
    process.exit(1);
  }

  console.log("Manifest Summary:");
  console.log(`  App: ${todoManifest.metadata.name}`);
  console.log(`  Version: ${todoManifest.version}`);
  console.log(
    `  Capabilities: ${Object.keys(todoManifest.capabilities).length}`
  );
  console.log("");

  console.log("Capabilities:");
  Object.entries(todoManifest.capabilities).forEach(([id, capability]) => {
    console.log(`  • ${id}: ${capability.parameters.length} parameters`);
  });
  console.log("");

  console.log("All validations passed! Manifest is ready to use.\n");
}

if (require.main === module) {
  validateTodoManifest();
}

export { validateTodoManifest };
