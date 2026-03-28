import React from 'react';
import Smelter from '@swmansion/smelter-node';
import { View, Rescaler, InputStream } from '@swmansion/smelter';

function SmelterScene() {
  return (
    <View style={{ backgroundColor: '#000000' }}>
      <Rescaler>
        <InputStream inputId="camera" />
      </Rescaler>
    </View>
  );
}

async function main() {
  const smelter = new Smelter();

  console.log('Initializing Smelter (downloading binaries if needed)...');
  await smelter.init();
  console.log('Smelter initialized with GPU rendering');

  // Register WHIP input - browser will send camera here
  const inputResult = await smelter.registerInput('camera', {
    type: 'whip_server',
    video: {},
  });
  console.log('WHIP input registered:', inputResult);

  // Register WHEP output - browser will receive composed stream
  const outputResult = await smelter.registerOutput(
    'output',
    <SmelterScene />,
    {
      type: 'whep_server',
      video: {
        resolution: { width: 1280, height: 720 },
        encoder: { type: 'ffmpeg_h264' },
      },
    }
  );
  console.log('WHEP output registered:', outputResult);

  await smelter.start();
  console.log('Smelter pipeline started!');
  console.log('');
  console.log('WHIP endpoint (send camera):', (inputResult as any).endpointRoute);
  console.log('WHIP bearer token:', (inputResult as any).bearerToken);
  console.log('WHEP endpoint (receive output):', (outputResult as any).endpointRoute);
  console.log('');
  console.log('Smelter API: http://localhost:8081');
  console.log('WHIP/WHEP server: http://localhost:9000');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
