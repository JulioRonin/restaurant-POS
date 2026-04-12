import ReceiptPrinterEncoder from 'esc-pos-encoder';

class PrinterService {
  private device: any = null;
  private btCharacteristic: any = null;
  private serverUrl = 'http://localhost:3001'; // Fallback / meta

  private async sendData(data: Uint8Array): Promise<void> {
    if (!this.device) {
        alert("La impresora no está conectada. Por favor, ve a Configuración y conéctala.");
        throw new Error('No device connected');
    }
    
    try {
        if (this.btCharacteristic) {
            // High-Stability Bluetooth Chunking for small buffer printers
            const CHUNK_SIZE = 32; // Safe for all thermal printers
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                
                // Chrome/Android GATT queue can only handle a few requests at a time.
                // Using writeValue (With Response) is slower but much more reliable
                // because it waits for the printer to acknowledge receipt.
                try {
                    await this.btCharacteristic.writeValue(chunk);
                } catch (writeErr: any) {
                    // Fallback to WithoutResponse if the characteristic doesn't support with response
                    if (this.btCharacteristic.writeValueWithoutResponse) {
                        await this.btCharacteristic.writeValueWithoutResponse(chunk);
                    } else {
                        throw writeErr;
                    }
                }
                
                // Small delay to allow the printer to process the buffer
                await new Promise(resolve => setTimeout(resolve, 80));
            }
        } else {
            await this.device.transferOut(this.getEndpointNum(), data);
        }
    } catch (err: any) {
        console.error('[PrinterService] Send failed:', err);
        alert(`Error de impresión: ${err.message}. La impresora está saturada o desconectada. Intenta apagarla y encenderla.`);
    }
  }

  async requestPrinter(): Promise<any | null> {
    try {
      this.device = await (navigator as any).usb.requestDevice({
        filters: []
      });
      return this.device;
    } catch (err) {
      console.error('USB Selection failed:', err);
      return null;
    }
  }

  async connect(device: any): Promise<boolean> {
    try {
      this.device = device;
      if (this.device.gatt) {
        // Bluetooth Device
        const server = await this.device.gatt.connect();
        
        // Dynamic discovery of printer services
        const services = await server.getPrimaryServices();
        let printerService = null;
        let printerChar = null;

        // Common Printer Service UUIDs
        const commonPrinterUUIDs = [
            '000018f0', '0000ff00', '0000ffe0', '000018f1', 
            '49535343', 'e7810400'
        ];

        for (const service of services) {
            console.log('[PrinterService] Found Service:', service.uuid);
            const isPrinterService = commonPrinterUUIDs.some(uuid => service.uuid.includes(uuid));
            
            if (isPrinterService) {
                const chars = await service.getCharacteristics();
                // Find first writeable characteristic
                const writeChar = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
                if (writeChar) {
                    printerService = service;
                    printerChar = writeChar;
                    break;
                }
            }
        }

        // Fallback: if no recognized service, try to find any writeable characteristic in the first service
        if (!printerChar && services.length > 0) {
            for (const service of services) {
                const chars = await service.getCharacteristics();
                const writeChar = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
                if (writeChar) {
                    printerChar = writeChar;
                    break;
                }
            }
        }

        if (printerChar) {
            this.btCharacteristic = printerChar;
            console.log('[PrinterService] Successfully bound to characteristic:', printerChar.uuid);
            return true;
        }

        throw new Error('Could not find a valid printing service on this device');
      } else {
        // USB Device: High-compatibility connection sequence
        await this.device.open();
        
        // Reset device if it was previously in a bad state
        try { await this.device.reset(); } catch(e) {}
        
        if (this.device.configuration === null) {
          await this.device.selectConfiguration(1);
        }

        // Proactively find the best interface for printing (usually the first one with Bulk Out)
        let targetInterface = 0;
        let targetAlternate = 0;

        for (const iface of this.device.configuration.interfaces) {
           for (const alt of iface.alternates) {
              if (alt.endpoints.some((e: any) => e.direction === 'out' && e.type === 'bulk')) {
                 targetInterface = iface.interfaceNumber;
                 targetAlternate = alt.alternateSetting;
                 break;
              }
           }
        }

        await this.device.claimInterface(targetInterface);
        if (targetAlternate !== 0) {
           await this.device.selectAlternateInterface(targetInterface, targetAlternate);
        }
        
        console.log(`[PrinterService] USB Interface ${targetInterface} claimed successfully.`);
        return true;
      }
    } catch (err) {
      console.error('Printer connection failed:', err);
      return false;
    }
  }

  async requestBluetoothPrinter(): Promise<any | null> {
    try {
      // Broaden search to support more thermal printers
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb', // Generic
            '0000ff00-0000-1000-8000-00805f9b34fb', // Common Chinese
            '0000ffe0-0000-1000-8000-00805f9b34fb', // Common Chinese Alternative
            '000018f1-0000-1000-8000-00805f9b34fb', // Alt Printer
            '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC
            'e7810400-410a-45c0-9315-dd95a1d74331', // Ribao/Others
            '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
            '0000180a-0000-1000-8000-00805f9b34fb'  // Device Info
        ]
      });
      return device;
    } catch (err) {
      console.error('Bluetooth Selection failed:', err);
      return null;
    }
  }

  async autoConnect(deviceName: string): Promise<boolean> {
    if (this.isConnected()) return true;
    if (!deviceName || deviceName === 'None') return false;

    // Retry loop for robustness (browsers/printers can be flaky after a refresh)
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`[PrinterService] Auto-connect attempt ${attempt} for: ${deviceName}`);
            
            // 1. Try Bluetooth Silent Connect
            if ('bluetooth' in navigator) {
                const btDevices = await (navigator as any).bluetooth.getDevices();
                // Match by exact name OR if we only have one thermal-like device, try it as a fallback
                const targetBt = btDevices.find((d: any) => d.name === deviceName) || (btDevices.length === 1 ? btDevices[0] : null);
                if (targetBt) {
                    console.log('[PrinterService] Found matching Bluetooth device:', targetBt.name);
                    const success = await this.connect(targetBt);
                    if (success) return true;
                }
            }

            // 2. Try USB Silent Connect
            if ('usb' in navigator) {
                const usbDevices = await (navigator as any).usb.getDevices();
                const targetUsb = usbDevices.find((d: any) => 
                    d.productName === deviceName || d.manufacturerName?.includes(deviceName)
                );
                if (targetUsb) {
                    const success = await this.connect(targetUsb);
                    if (success) return true;
                }
            }

            // Wait a bit before next attempt
            if (attempt === 1) await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
            console.warn(`[PrinterService] Attempt ${attempt} failed:`, err);
        }
    }

    return false;
  }

  async heartbeat(): Promise<boolean> {
    if (!this.isConnected()) return false;
    try {
        if (this.btCharacteristic) {
            // Send Real-time printer status command (DLE EOT 1)
            // This is a benign command that keeps the connection alive
            await this.btCharacteristic.writeValue(new Uint8Array([0x10, 0x04, 0x01]));
            return true;
        }
        return true;
    } catch (e) {
        console.warn('[PrinterService] Heartbeat failed:', e);
        return false;
    }
  }

  async requestWakeLock(): Promise<any> {
    if ('wakeLock' in navigator) {
        try {
            const sentinel = await (navigator as any).wakeLock.request('screen');
            return sentinel;
        } catch (err: any) {
            console.warn(`[PrinterService] WakeLock failed: ${err.message}`);
        }
    }
    return null;
  }

  isConnected(): boolean {
    if (!this.device) return false;
    
    // For Bluetooth
    if (this.device.gatt) {
        return this.device.gatt.connected || false;
    }
    
    // For USB
    return this.device.opened || false;
  }

  /**
   * Proactive repair helper: used from UI icons to ensure connection
   */
  async connectStoredDevice(deviceName: string): Promise<boolean> {
     console.log('[PrinterService] Attempting to repair connection to:', deviceName);
     
     // 1. Try silent first
     const silentOk = await this.autoConnect(deviceName);
     if (silentOk) return true;
     
     // 2. If silent failed, it might be a permission expiration. 
     // We MUST trigger a requestDevice (active) which requires this user gesture.
     try {
        if (window.confirm(`La impresora "${deviceName}" está desconectada. ¿Deseas volver a vincularla ahora?`)) {
            // Check if it's likely USB (many thermal printers have 'Printer' or 'USB' in name)
            // or just ask user to pick. 
            // For robustness, we trigger the Bluetooth one as it's the most common for mobile POS
            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [{ services: ['000018f0'] }, { services: ['0000ffe0'] }],
                optionalServices: ['000018f0', '0000ffe0', '0000ff00', '000018f1']
            });
            if (device) return await this.connect(device);
        }
     } catch (e) {
        console.error('[PrinterService] Repair failed:', e);
     }
     return false;
  }

  async printOrder(order: any, settings: any): Promise<boolean> {
    // Proactively attempt to reconnect if we have a saved device name
    if (!this.isConnected() && settings.connectedDeviceName && settings.connectedDeviceName !== 'None') {
        console.log('[PrinterService] Connection lost. Attempting silent wake-up for:', settings.connectedDeviceName);
        const reconnected = await this.autoConnect(settings.connectedDeviceName);
        if (!reconnected) {
            console.warn('[PrinterService] Silent auto-connect failed.');
        }
    }

    if (!this.isConnected()) {
       console.warn('[PrinterService] No direct printer active.');
       return false;
    }

    try {
      console.log('[PrinterService] Starting print process for order:', order.id);
      const encoder = new ReceiptPrinterEncoder();
      const is58mm = settings.printerWidth === '58mm';
      const lineChars = is58mm ? 26 : 42;

      // Helper for Manual Centering
      const center = (text: string) => {
        const str = (text || '').trim().slice(0, lineChars);
        const pad = Math.max(0, Math.floor((lineChars - str.length) / 2));
        return ' '.repeat(pad) + str;
      };

      // Helper for Wrapped Centering
      const wrapCenter = (text: string) => {
        const words = (text || '').toString().split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
          if ((currentLine + word).length <= lineChars) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) lines.push(center(currentLine));
            currentLine = word;
          }
        });
        if (currentLine) lines.push(center(currentLine));
        return lines;
      };

      let result = encoder.initialize();
      
      try {
          result = result.align('left').size('normal');
          
          wrapCenter(settings.name || 'CULINEX').forEach(l => result = result.text(l).newline());
          if (settings.legalName) wrapCenter(settings.legalName).forEach(l => result = result.text(l).newline());
          if (settings.address) wrapCenter(settings.address).forEach(l => result = result.text(l).newline());
          if (settings.phone) wrapCenter(settings.phone).forEach(l => result = result.text(l).newline());

          result = result.text('-'.repeat(lineChars)).newline();
          result = result.text(`ORDEN: #${order.id.slice(-6).toUpperCase()}`).newline();
          
          const timestamp = order.timestamp || new Date();
          result = result.text(`FECHA: ${new Date(timestamp).toLocaleDateString()}`).newline();
          result = result.text(`HORA: ${new Date(timestamp).toLocaleTimeString()}`).newline();

          if (order.tableId) result.text(`MESA: ${order.tableId}`).newline();
          if (order.waiterName) result.text(`MESERO: ${order.waiterName}`).newline();

          result = result.text('-'.repeat(lineChars)).newline();
          
          // Column Header
          const colHeader = is58mm ? 'CAN PRODUCTO         TOTAL' : 'CANT  PRODUCTO                    TOTAL';
          result = result.text(colHeader).newline();

          order.items.forEach((item: any) => {
            if (is58mm) {
              const qty = item.quantity.toString().padEnd(3);
              const name = (item.name || 'ITEM').toUpperCase().slice(0, 13).padEnd(14);
              const price = (item.price * item.quantity).toFixed(2).padStart(8);
              result = result.text(`${qty}${name}${price}`).newline();
            } else {
              const qty = item.quantity.toString().padEnd(5);
              const name = (item.name || 'ITEM').toUpperCase().slice(0, 25).padEnd(27);
              const price = (item.price * item.quantity).toFixed(2).padStart(10);
              result = result.text(`${qty}${name}${price}`).newline();
            }
          });

          result = result.text('-'.repeat(lineChars)).newline();

          if (order.receivedAmount !== undefined && order.receivedAmount > 0) {
            const recLabel = 'RECIBIDO:'.padEnd(15);
            const recVal = `$${order.receivedAmount.toFixed(2)}`.padStart(is58mm ? 10 : 25);
            result = result.text(`${recLabel}${recVal}`).newline();
            const changeLabel = 'CAMBIO:'.padEnd(15);
            const changeVal = `$${(order.changeAmount || 0).toFixed(2)}`.padStart(is58mm ? 10 : 25);
            result = result.text(`${changeLabel}${changeVal}`).newline();
          }

          const totalLabel = 'TOTAL:'.padEnd(8);
          const totalVal = `$${(order.total || 0).toFixed(2)}`.padStart(is58mm ? 17 : 33);
          result = result.text(`${totalLabel}${totalVal}`).newline().newline();

          wrapCenter(settings.footerMessage || '¡Gracias!').forEach(l => result = result.text(l).newline());
          result = result.newline().cut().encode();
      } catch (encodeErr: any) {
          console.error('[PrinterService] Encoding error:', encodeErr);
          alert(`Error de formato de ticket: ${encodeErr.message}`);
          return false;
      }

      await this.sendData(result);
      console.log('[PrinterService] Data sent successfully');
      return true;
    } catch (err: any) {
      console.error('[PrinterService] Direct printing crash:', err);
      // Only alert if we haven't already alerted in sendData
      if (!err.message.includes('No device connected')) {
          alert(`Error crítico de impresora: ${err.message}`);
      }
      return false;
    }
  }

  async openCashDrawer(): Promise<boolean> {
    if (!this.device) {
       console.warn('No direct printer connected to open drawer.');
       return false;
    }

    try {
      const encoder = new ReceiptPrinterEncoder();
      
      const result = encoder.initialize()
        .raw([0x1b, 0x3d, 0x01]) // ESC = 1: Select peripheral
        .pulse(0, 50, 250)      // Pin 2
        .pulse(1, 50, 250)      // Pin 5
        .encode();

      await this.sendData(result);
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (err) {
      console.error('Failed to open cash drawer:', err);
      return false;
    }
  }

  async printCashCut(data: any, settings: any): Promise<boolean> {
    if (!this.device) {
       console.warn('No direct printer connected for cash cut.');
       return false;
    }

    try {
      const encoder = new ReceiptPrinterEncoder();
      const is58mm = settings.printerWidth === '58mm';
      const lineChars = is58mm ? 26 : 42;

      const center = (text: string) => {
        const str = (text || '').trim().slice(0, lineChars);
        const pad = Math.max(0, Math.floor((lineChars - str.length) / 2));
        return ' '.repeat(pad) + str;
      };

      const wrapCenter = (text: string) => {
        const words = (text || '').split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
          if ((currentLine + word).length <= lineChars) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) lines.push(center(currentLine));
            currentLine = word;
          }
        });
        if (currentLine) lines.push(center(currentLine));
        return lines;
      };

      let result = encoder.initialize()
        .align('center')
        .size('normal');

      // Header
      wrapCenter(settings.name.toUpperCase()).forEach(l => result = result.text(l).newline());
      result = result.text(center('CORTE DE CAJA')).newline()
        .text(center(new Date().toLocaleString()))
        .newline()
        .text('='.repeat(lineChars))
        .newline()
        .align('left');

      // Metrics Summary
      const lblRev = 'INGRESOS:'.padEnd(12);
      const valRev = `$${data.metrics.totalRevenue.toFixed(2)}`.padStart(is58mm ? 14 : 30);
      result = result.text(`${lblRev}${valRev}`).newline();

      const lblExp = 'GASTOS:'.padEnd(12);
      const valExp = `-$${data.totalExpenses.toFixed(2)}`.padStart(is58mm ? 14 : 30);
      result = result.text(`${lblExp}${valExp}`).newline();

      const lblNet = 'NETO:'.padEnd(12);
      const valNet = `$${(data.metrics.totalRevenue - data.totalExpenses).toFixed(2)}`.padStart(is58mm ? 14 : 30);
      result = result.size('normal').text(`${lblNet}${valNet}`).newline()
        .text('-'.repeat(lineChars))
        .newline();

      // Detailed Orders
      result = result.text(center('DETALLE DE VENTAS')).newline();
      if (is58mm) {
        // 26 chars: 6 (ID) + 1 + 10 (MESA) + 1 + 8 (MONTO)
        result.text('ID     MESA/REF      MONTO').newline();
      } else {
        // 42 chars: 8 (ID) + 2 + 22 (MESA) + 2 + 8 (MONTO)
        result.text('ID       MESA/REF                   MONTO').newline();
      }

      data.orders.forEach((order: any) => {
        const id = `#${order.id.slice(-4)}`.padEnd(is58mm ? 6 : 8);
        const table = (order.tableId || 'VENTA').toUpperCase().slice(0, is58mm ? 10 : 22).padEnd(is58mm ? 11 : 24);
        const amt = `$${order.total.toFixed(2)}`.padStart(is58mm ? 8 : 10);
        result = result.text(`${id}${table}${amt}`).newline();
      });

      result = result.text('-'.repeat(lineChars)).newline();
      const lblSuma = 'SUMA TOTAL:'.padEnd(12);
      const valSuma = `$${data.metrics.totalRevenue.toFixed(2)}`.padStart(is58mm ? 14 : 30);
      result = result.text(`${lblSuma}${valSuma}`).newline()
        .text('='.repeat(lineChars))
        .newline();

      // Footer
      result = result
        .newline()
        .text(center('--- CIERRE DE TURNO ---'))
        .newline()
        .text(center('Culinex POS'))
        .newline()
        .text(center('Ronin Studio'))
        .newline()
        .newline()
        .cut()
        .encode();

      await this.sendData(result);
      return true;
    } catch (err) {
      console.error('Cash cut printing failed:', err);
      return false;
    }
  }

  async printKitchenTicket(order: any, settings: any): Promise<boolean> {
    // Proactively attempt to reconnect if we have a saved device name
    if (!this.isConnected() && settings.connectedDeviceName && settings.connectedDeviceName !== 'None') {
        console.log('[PrinterService] Kitchen Connection lost. Attempting silent wake-up for:', settings.connectedDeviceName);
        const reconnected = await this.autoConnect(settings.connectedDeviceName);
        if (!reconnected) {
            console.warn('[PrinterService] Kitchen Silent auto-connect failed.');
        }
    }

    if (!this.isConnected()) {
       console.warn('[PrinterService] No direct printer active for kitchen.');
       return false;
    }

    try {
      const encoder = new ReceiptPrinterEncoder();
      const is58mm = settings.printerWidth === '58mm';
      const lineChars = is58mm ? 26 : 42;

      const center = (text: string) => {
        const str = (text || '').trim().slice(0, lineChars);
        const pad = Math.max(0, Math.floor((lineChars - str.length) / 2));
        return ' '.repeat(pad) + str;
      };

      const wrapCenter = (text: string) => {
        const words = (text || '').split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
          if ((currentLine + word).length <= lineChars) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) lines.push(center(currentLine));
            currentLine = word;
          }
        });
        if (currentLine) lines.push(center(currentLine));
        return lines;
      };

      let result = encoder.initialize()
        .align('left')
        .size('double')
        .text(center(order.tableId.toUpperCase()))
        .newline()
        .size('normal')
        .text(center(`ORDEN: #${order.id}`))
        .newline()
        .text(center(`${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | ${order.waiterName || 'MESERO'}`))
        .newline()
        .text('='.repeat(lineChars))
        .newline();

      order.items.forEach((item: any) => {
        // Quantity + Name (Large)
        // For 58mm (26 chars), double size only fits 13 chars. 
        // We'll use normal size if the name is long, or just slice to 13.
        const nameText = item.name.toUpperCase();
        
        result = result
          .size('double')
          .text(`${item.quantity}x `)
          .text(nameText.slice(0, Math.min(nameText.length, lineChars / 2 - 4)))
          .newline()
          .size('normal');
          
        // If name was truncated, print the rest in normal size
        if (nameText.length > (lineChars / 2 - 4)) {
           result = result.text(`   ${nameText.slice(lineChars / 2 - 4)}`).newline();
        }

        // Notes (Emphasized) - Ensure it's not undefined or empty
        if (item.notes && item.notes.trim() !== '') {
          result = result
            .newline()
            .text('  >>> NOTA: ')
            .newline();
          
          // Wrap the note manually to ensure visibility
          const noteLines = wrapCenter(item.notes.toUpperCase());
          noteLines.forEach(l => result = result.text(l).newline());
          
          result = result.newline();
        }
        
        result = result.text('-'.repeat(lineChars)).newline();
      });

      result = result
        .newline()
        .text(center('--- FIN DE COMANDA ---'))
        .newline()
        .text(center('Culinex POS'))
        .newline()
        .text(center('Ronin Studio'))
        .newline()
        .newline()
        .cut()
        .encode();

      await this.sendData(result);
      return true;
    } catch (err) {
      console.error('Kitchen printing failed:', err);
      return false;
    }
  }

  private getEndpointNum(): number {
    // Standard endpoint for most printers is 1 or 2
    if (!this.device || this.btCharacteristic) return 1;
    try {
      const iface = this.device.configurations[0].interfaces[0];
      const endpoint = iface.alternates[0].endpoints.find((e: any) => e.direction === 'out');
      return endpoint ? endpoint.endpointNumber : 1;
    } catch (e) {
      return 1;
    }
  }

  async disconnect() {
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
  }
}

export const printerService = new PrinterService();
