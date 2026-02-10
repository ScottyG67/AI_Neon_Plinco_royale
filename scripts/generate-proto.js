const protobuf = require('protobufjs');
const fs = require('fs');
const path = require('path');

async function generateProto() {
  const protoPath = path.join(__dirname, '../proto/game.proto');
  const outputDir = path.join(__dirname, '../generated');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    // Load and parse proto file
    const root = await protobuf.load(protoPath);
    
    // Generate TypeScript definitions (basic structure)
    // Note: protobufjs doesn't generate TS directly, but we can use it at runtime
    // For TypeScript types, we'll create them manually or use @protobufjs/ts-proto
    
    console.log('Proto file loaded successfully');
    console.log('Available messages:', root.nested.game.nested);
    
    // Save the root for runtime use
    const jsonRoot = root.toJSON();
    fs.writeFileSync(
      path.join(outputDir, 'game.proto.json'),
      JSON.stringify(jsonRoot, null, 2)
    );
    
    console.log('Proto JSON saved to generated/game.proto.json');
  } catch (error) {
    console.error('Error generating proto:', error);
    process.exit(1);
  }
}

generateProto();
