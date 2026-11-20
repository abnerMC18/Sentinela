export default class SensorBase {
    #idLeitura;
    #timestamp;

    constructor() {
        this.#idLeitura = Math.random().toString(36).substr(2, 9);
        this.#timestamp = new Date().toLocaleTimeString('pt-BR');
    }

    get id() { return this.#idLeitura; }
    get horario() { return this.#timestamp; }

    // Método "Abstrato"
    processarLeitura() {
        // Se a classe filha não criar sua própria versão desse método, o sistema acusa erro.
        throw new Error("O método processarLeitura() deve ser implementado pela classe filha!");
    }
}