/**
 * Service to handle Bluetooth Payment Terminal discovery and mock transactions.
 * Uses Web Bluetooth API (navigator.bluetooth).
 */
class BluetoothTerminalService {
  private device: BluetoothDevice | null = null;

  /**
   * Opens the browser's Bluetooth discovery dialog.
   * Filters for common terminal-like services or any device.
   */
  async requestTerminal(): Promise<BluetoothDevice | null> {
    if (!navigator.bluetooth) {
      console.error('Web Bluetooth is not supported in this browser.');
      return null;
    }

    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        // In a real scenario, you'd filter by services:
        // filters: [{ services: ['payment_service_uuid'] }]
      });
      return this.device;
    } catch (error) {
      console.error('Bluetooth discovery cancelled or failed:', error);
      return null;
    }
  }

  /**
   * Connects to the GATT server of the selected device (Mocked for now).
   */
  async connect(device: BluetoothDevice): Promise<boolean> {
    try {
      // In a real device:
      // const server = await device.gatt?.connect();
      // Keep track of connection status
      console.log(`Connected to ${device.name}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to Bluetooth terminal:', error);
      return false;
    }
  }

  /**
   * Simulates a payment transaction with the terminal.
   * Includes technical steps: Handshake, Processing, Result.
   */
  async simulateTransaction(amount: number, onProgress: (step: string) => void): Promise<boolean> {
    return new Promise((resolve) => {
      const steps = [
          { msg: 'Estableciendo canal seguro Bluetooth...', delay: 1000 },
          { msg: 'Sincronizando monto: $' + amount.toFixed(2), delay: 1500 },
          { msg: 'Esperando lectura de tarjeta (EMV/Contactless)...', delay: 3000 },
          { msg: 'Comunicando con el banco emisor...', delay: 2000 },
          { msg: 'Autorizando transacción...', delay: 1500 },
          { msg: '¡Pago aprobado! Generando ticket...', delay: 500 }
      ];

      let currentStep = 0;
      const next = () => {
          if (currentStep < steps.length) {
              onProgress(steps[currentStep].msg);
              setTimeout(() => {
                  currentStep++;
                  next();
              }, steps[currentStep].delay);
          } else {
              resolve(true);
          }
      };

      next();
    });
  }
}

export const bluetoothTerminalService = new BluetoothTerminalService();
