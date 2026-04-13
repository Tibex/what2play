import { Module } from '@nestjs/common';
import { GoogleVisionService } from './google-vision.service';
import { ClaudeVisionService } from './claude-vision.service';

@Module({
  providers: [GoogleVisionService, ClaudeVisionService],
  exports: [GoogleVisionService, ClaudeVisionService],
})
export class VisionModule {}
