import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';

@Module({
  imports: [FilesModule],
  controllers: [AttributesController],
  providers: [AttributesService],
})
export class AttributesModule {}
