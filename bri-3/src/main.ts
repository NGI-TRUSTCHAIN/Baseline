import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('BRI-3 example')
    .setDescription('The bri-3 API description')
    .setVersion('1.0')
    .addTag('bri-3')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, documentFactory);

  //Please refer and document here: https://github.com/eea-oasis/baseline/issues/593
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
