import { getRemoteTemplatesList } from "../utils/getTemplate.ts";

export async function listTemplates(): Promise<void> {
  console.log(`\n📋 Available templates:\n`);

  console.log(`🌐 Remote templates:`);
  const remoteTemplates = await getRemoteTemplatesList();

  if (remoteTemplates.length === 0) {
    console.log(`   No remote templates found.`);
  } else {
    remoteTemplates.forEach((template) => {
      console.log(`   • ${template}`);
    });
  }

  console.log();
}
