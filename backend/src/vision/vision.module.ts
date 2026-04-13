import { Module } from '@nestjs/common';
import { GoogleVisionService } from './google-vision.service';
import { ClaudeVisionService } from './claude-vision.service';
import { GeminiVisionService } from './gemini-vision.service';

@Module({
  providers: [GoogleVisionService, ClaudeVisionService, GeminiVisionService],
  exports: [GoogleVisionService, ClaudeVisionService, GeminiVisionService],
})
export class VisionModule {}
