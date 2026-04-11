import { Module } from '@nestjs/common';
import { GoogleVisionService } from './google-vision.service';

@Module({
  providers: [GoogleVisionService],
  exports: [GoogleVisionService],
})
export class VisionModule {}
