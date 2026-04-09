import ReceiptPrinterEncoder from 'esc-pos-encoder';

class PrinterService {
  private device: any = null;
  private btCharacteristic: any = null;
  private serverUrl = 'http://localhost:3001'; // Fallback / meta

  private async sendData(data: Uint8Array): Promise<void> {
    if (!this.device) throw new Error('No device connected');
    
    if (this.btCharacteristic) {
      // Bluetooth Chunking (Fix for MTU limits)
      const CHUNK_SIZE = 512;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await this.btCharacteristic.writeValue(chunk);
        // Small delay to prevent overflow on some printers
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } else {
      await this.device.transferOut(this.getEndpointNum(), data);
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
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb'); // Generic printer UUID
        const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb'); // Generic write UUID
        this.btCharacteristic = characteristic;
        return true;
      } else {
        // USB Device
        await this.device.open();
        if (this.device.configuration === null) {
          await this.device.selectConfiguration(1);
        }
        await this.device.claimInterface(0);
        return true;
      }
    } catch (err) {
      console.error('Printer connection failed:', err);
      return false;
    }
  }

  async requestBluetoothPrinter(): Promise<any | null> {
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
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
                const targetBt = btDevices.find((d: any) => d.name === deviceName);
                if (targetBt) {
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
    if (this.btCharacteristic) {
      return this.device.gatt?.connected || false;
    }
    return this.device.opened || false;
  }

  async printOrder(order: any, settings: any): Promise<boolean> {
    if (!this.device) {
       console.warn('No direct printer connected. Use window.print()');
       return false;
    }

    try {
      const encoder = new ReceiptPrinterEncoder();
      const is58mm = settings.printerWidth === '58mm';
      const lineChars = is58mm ? 26 : 42;

      // Helper for Manual Centering
      const center = (text: string) => {
        const str = text.trim().slice(0, lineChars);
        const pad = Math.max(0, Math.floor((lineChars - str.length) / 2));
        return ' '.repeat(pad) + str;
      };

      // Helper for Wrapped Centering
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
        .size('normal');

      // Centered Header with manual padding
      wrapCenter(settings.name.toUpperCase()).forEach(l => result = result.text(l).newline());
      wrapCenter(settings.legalName).forEach(l => result = result.text(l).newline());
      wrapCenter(settings.rfc).forEach(l => result = result.text(l).newline());
      wrapCenter(settings.address).forEach(l => result = result.text(l).newline());
      wrapCenter(settings.phone).forEach(l => result = result.text(l).newline());

      result = result
        .text('-'.repeat(lineChars))
        .newline()
        .align('left')
        .text(`ORDEN: #${order.id.slice(-6).toUpperCase()}`)
        .newline()
        .text(`FECHA: ${new Date(order.timestamp).toLocaleDateString()}`)
        .newline()
        .text(`HORA: ${new Date(order.timestamp).toLocaleTimeString()}`)
        .newline();

      if (order.tableId) result.text(`MESA: ${order.tableId}`).newline();
      if (order.waiterName) result.text(`MESERO: ${order.waiterName}`).newline();

      result = result.text('-'.repeat(lineChars)).newline();
      
      // Column Header
      if (is58mm) {
        // 26 chars: 3 (CAN) + 1 + 13 (PRODUCTO) + 1 + 8 (TOTAL)
        result.text('CAN PRODUCTO         TOTAL').newline();
      } else {
        result.text('CANT  PRODUCTO                    TOTAL').newline();
      }

      order.items.forEach((item: any) => {
        if (is58mm) {
          // 26 chars: 3 (qty) + 1 + 13 (name) + 1 + 8 (total) = 26
          const qty = item.quantity.toString().padEnd(3);
          const name = item.name.toUpperCase().slice(0, 13).padEnd(14);
          const price = (item.price * item.quantity).toFixed(2).padStart(8);
          result.text(`${qty}${name}${price}`).newline();
        } else {
          // 80mm: 5 (qty) + 2 + 25 (name) + 2 + 8 (total) = 42
          const qty = item.quantity.toString().padEnd(5);
          const name = item.name.toUpperCase().slice(0, 25).padEnd(27);
          const price = (item.price * item.quantity).toFixed(2).padStart(10);
          result.text(`${qty}${name}${price}`).newline();
        }
      });

      result = result.text('-'.repeat(lineChars)).newline();

      if (order.receivedAmount !== undefined && order.receivedAmount > 0) {
        const recLabel = 'RECIBIDO:'.padEnd(15);
        const recVal = `$${order.receivedAmount.toFixed(2)}`.padStart(is58mm ? 15 : 27);
        result.text(`${recLabel}${recVal}`).newline();
        
        const changeLabel = 'CAMBIO:'.padEnd(15);
        const changeVal = `$${(order.changeAmount || 0).toFixed(2)}`.padStart(is58mm ? 15 : 27);
        result.text(`${changeLabel}${changeVal}`).newline();
      }

      const totalLabel = 'TOTAL:'.padEnd(8);
      const totalVal = `$${order.total.toFixed(2)}`.padStart(is58mm ? 18 : 32);
      result = result
        .size('normal')
        .text(`${totalLabel}${totalVal}`)
        .newline()
        .newline();

      // Footer Message
      wrapCenter(`PAGO: ${order.paymentMethod || 'EFECTIVO'}`).forEach(l => result = result.text(l).newline());
      result = result.text('-'.repeat(lineChars)).newline();
      wrapCenter(settings.footerMessage).forEach(l => result = result.text(l).newline());
      wrapCenter('Culinex POS').forEach(l => result = result.text(l).newline());
      wrapCenter('Ronin Studio').forEach(l => result = result.text(l).newline());

      result = result
        .newline()
        .cut()
        .encode();

      await this.sendData(result);
      return true;
    } catch (err) {
      console.error('Direct printing failed:', err);
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
        .pulse(0, 25, 250)      // Pin 2 - Single Pulse
        .encode();

      await this.sendData(result);
      
      // Delay to allow physical movement before printer buffer clears
      await new Promise(resolve => setTimeout(resolve, 300));
      
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
    if (!this.device) {
       console.warn('No direct printer connected for kitchen ticket.');
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
