import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LoggingModule } from '../../shared/logging/logging.module';
import { CircuitInputsParserService } from './services/circuit/circuitInputsParser/circuitInputParser.service';
import { SnarkjsCircuitService } from './services/circuit/snarkjs/snarkjs.service';
import { GeneralCircuitInputsParserService } from './services/circuit/circuitInputsParser/generalCircuitInputParser.service';

@Module({
  imports: [CqrsModule, LoggingModule],

  providers: [
    CircuitInputsParserService,
    GeneralCircuitInputsParserService,
    {
      provide: 'ICircuitService',
      useClass: SnarkjsCircuitService,
    },
  ],
  exports: [
    'ICircuitService',
    CircuitInputsParserService,
    GeneralCircuitInputsParserService,
  ],
})
export class ZeroKnowledgeProofModule {}
