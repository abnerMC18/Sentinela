import SensorBase from './SensorBase.js';

export default class SensorAmbiental extends SensorBase {
    // ... (construtor, variáveis privadas e setters que já fizemos) ...

    // O Sensor Ambiental responde ao Polimorfismo assim:
    processarLeitura() {
        return {
            tipo: 'Ambiental',
            id: super.id,
            horario: super.horario,
            temperatura: this.temperatura,
            umidadeSolo: this.umidadeSolo,
            nivelChuva: this.nivelChuva,
            risco: this.umidadeSolo > 70 ? 'ALTO' : 'NORMAL'
        };
    }
}