'use strict';
const noble = require('@abandonware/noble');
const fs = require('fs');
const util = require('util')

let skipList = []
// read the skipList from disk
if (fs.existsSync('skiplist.json')) {
    skipList = JSON.parse(fs.readFileSync('skiplist.json')).skipList
}

let foundTargetDevice = false

const initialValue = 1
const maxValue = 0xFFFFFF; // 16,777,215 in decimal
let value = initialValue

const checkInterval = 100 // value in ms before we attempt to rewrite values
const MTU_SIZE = 247; // Maximum Transmission Unit, found in https://github.com/was3912734/TUYA-Magic-wand/blob/0185fd825280f58e4fdd16d1a2582c84cb301b4c/example/tuya-ble-sdk-demo-project-phy6222-V2.1.2/tuya_ble_sdk_demo/tuya_ble_sdk/README.md?plain=1#L63

const writeCharacteristicUuid = '0000000100001001800100805f9b07d0'
const readCharacteristicUuid =  '0000000300001001800100805f9b07d0'
// const expectedPeripheralUuid = `cbf4e8e353ca8d8ccfa382d1c3ab1560` // I don't know if this should change for other go karts, not using for now because we can use "GLW" device name

// Relevant Tuya command IDs for toggling a switch
// from https://developer.tuya.com/en/docs/iot/tuya-cloud-universal-serial-port-access-protocol?id=K9eigf2el456o
// 0x00: Detect heartbeat
// 0x01: Get MCU information
// 0x02: Request working mode
// 0x03: Send module’s status
// 0x04: Reset the module
// 0x05: Reset the module (New)
// 0x06: Send commands
// 0x07: Report status
// 0x08: Query status
// 0x09: Unbind the module
// 0x0A: Query module’s connection status
// 0xE0: Report record-type data
// 0xE1: Get the current time
// 0xA1: Notify a factory reset
// 0xA0: Query module’s version number
// 0xE8: Query MCU’s version number
// 0xE9: Proactive MCU version reporting
// 0xEA: Initiate an update request
// 0xEB: Send the update information
// 0xEC: Request the update offset
// 0xED: Transmit the update
// 0xEE: Request the update result
// 0x0E: Radio frequency (RF)
// 0xE5: Enable low power feature
// 0xE4: Configure system timer
// 0xE3: Configure the module wake-up pin
// 0xB0: Configure MCU wake-up time
// 0xA4: Flag-based status reporting
// 0xB5: Bulk data storage
// 0xB6: Get weather data
// 0xBC: Triggered pairing mode
// 0xC100: Bluetooth remote control configuration
// 0xC101: Bluetooth remote control data notification
// 0xC102: Bluetooth remote control binding notification
// 0xC000: Cross-protocol data pass-through
// 0xC001: Power control of extended module
// 0xC002: Query the extended module’s presence
// 0xC003: Configuration of extended module
// 0xC200: Sync accessory status
// 0xE7: Disconnect Bluetooth proactively
// 0xA3: Advertising enablement
// 0xA5: Request getting online
// 0xE2: Modify advertising interval in low power mode
// 0xB1: Set the connection interval
// 0xBA: Human interface device (HID)
// 0xBB: Set advertising name
// 0xBD: Adjust Bluetooth transmitter power
// 0xBE: Query module’s MAC address
// 0xE6: Verify dynamic password
// 0xA7: Verify dynamic password (New)
// 0xA2: Offline password
// 0xA6: Smart lock services
// 0xA8: Configure iBeacon

// Helper function to create Tuya command packets with checksum
function createTuyaCommand(commandId, data) {
    // The header is always constant for Tuya commands
    const header = Buffer.from([0x55, 0xaa]);
    // The command ID is passed as a parameter and should be one byte
    const command = Buffer.from([commandId]);
    // Data is already a buffer passed to the function
    const dataBuffer = Buffer.from(data); 
    // The data length should be two bytes (little-endian), representing the length of the data buffer
    const dataLength = Buffer.alloc(2);
    dataLength[0] = dataBuffer.length & 0xFF;        // Lower byte of the length
    dataLength[1] = (dataBuffer.length >> 8) & 0xFF; // Higher byte of the length
    
    // Concatenate all parts to calculate the checksum
    const packetWithoutChecksum = Buffer.concat([header, command, dataLength, dataBuffer]);
    
    // Calculate checksum as the sum of all bytes modulo 256
    let checksum = 0;
    for (let byte of packetWithoutChecksum) {
        checksum += byte;
    }
    checksum %= 256;
    
    // Append the checksum to the packet
    const checksumBuffer = Buffer.from([checksum]);
    
    // Return the complete packet
    return Buffer.concat([packetWithoutChecksum, checksumBuffer]);
}


const skipActions = (peripheral) => {

    if (skipList.includes(peripheral.id)) {
        return true
    }

    if (foundTargetDevice) {
        return true
    }

    //console.log('Found device:', peripheral.advertisement.localName);

    if (peripheral.advertisement.localName !== 'GWL') {

        //console.log(peripheral)

        console.log(`push ${peripheral.id} with ${peripheral.advertisement.localName} to skipList`)

        skipList.push(peripheral.id)

        // store the skipList on disk as skiplist.json
        fs.writeFileSync('skiplist.json', JSON.stringify({skipList}, null, 2));

        return true
    }

    return false
}


const writeBufferValue = async (writeCharacteristic, buffer) => {
    return await new Promise((resolve) => {

        writeCharacteristic.write(buffer, false, (writeError) => {

            if (writeError) {

                console.error(`Write error with value ${value}:`, writeError);
                peripheral.disconnect(); 
                return
            }

            // console.log(`Wrote value: ${value}`);

            return resolve()
        })
    })
}

const readBufferValue = async (readCharacteristic) => {
    return await new Promise((resolve) => {
            
        // Read the characteristic after write
        readCharacteristic.read((readError, newData) => {

            if (readError) {

                console.error('Read error:', readError);

                return
            }

            // console.log(`State after reading ${value}:`, newData.toString('hex'));

            return resolve(newData)
        })
    })
}

async function getMCUInformation(peripheral, writeCharacteristic, readCharacteristic) {

    const commandId = 0x01; // Command ID for getting MCU information
    const data = new Buffer.alloc(0); // Assuming no data is needed for this command

    let commandBuffer = createTuyaCommand(commandId, data);
    console.log('Sending Get MCU Information Command:', commandBuffer.toString('hex'));
    console.log(commandBuffer)

    // Write the command to the characteristic
    writeCharacteristic.write(commandBuffer, false, (error) => {
        if (error) {
            console.error('Error sending MCU information command:', error);
            return;
        }
        console.log('MCU information command sent successfully');
    });

    // Assuming response will be read from a notification/indication
    // return new Promise((resolve) => {
    //     writeCharacteristic.on('data', (data, isNotification) => {
    //         console.log('Received MCU Information Response:', data.toString('hex'));
    //         console.log(data)
    //         resolve();
    //     });
    // });

    let initialData = await readBufferValue(readCharacteristic)

    console.log('mcu after reading:', initialData.toString('hex'));
    console.log(initialData)
}

async function requestWorkingMode(peripheral, writeCharacteristic, readCharacteristic) {

    const commandId = 0x02; // Command ID for requesting working mode
    const data = new Buffer.alloc(0); // Assuming no data is needed for this command

    let commandBuffer = createTuyaCommand(commandId, data);
    console.log('Requesting Working Mode:', commandBuffer.toString('hex'));

    // Write the command to the characteristic
    writeCharacteristic.write(commandBuffer, false, (error) => {
        if (error) {
            console.error('Error requesting working mode:', error);
            return;
        }
        console.log('Request for working mode sent successfully');
    });

    // Assuming response will be read from a notification/indication
    // return new Promise((resolve) => {
    //     writeCharacteristic.on('data', (data, isNotification) => {
    //         console.log('Received Working Mode Response:', data.toString('hex'));
    //         console.log(data)
    //         resolve();
    //     });
    // });

    let initialData = await readBufferValue(readCharacteristic)

    console.log('working mode after reading:', initialData.toString('hex'));
    console.log(initialData)
}

// Function to send the heartbeat command using the existing createTuyaCommand function
async function sendHeartbeatCommand(peripheral, writeCharacteristic, readCharacteristic) {

    const commandId = 0x00; // Command ID for heartbeat
    const data = new Buffer.alloc(0); // No data is needed for the heartbeat command

    let commandBuffer = createTuyaCommand(commandId, data);
    console.log('Sending Heartbeat Command:', commandBuffer.toString('hex'));
    console.log(commandBuffer)
    console.log(typeof commandBuffer)

    // Write the command to the characteristic
    writeCharacteristic.write(commandBuffer, false, (error) => {
        if (error) {
            console.error('Error sending heartbeat command:', error);
            return;
        }
        console.log('Heartbeat command sent successfully');
    });

    // Assuming response will be read from a notification/indication
    // return new Promise((resolve) => {
    //     writeCharacteristic.on('data', (data, isNotification) => {
    //         handleHeartbeatResponse(data);
    //         resolve();
    //     });
    // })


    let initialData = await readBufferValue(readCharacteristic)

    console.log('heartbeat after reading:', initialData.toString('hex'));
    console.log(initialData)

    return
}

const peripheralConnectActions = (peripheral) => {

    console.log(`setting up peripheral event listeners`)

    peripheral.once('connect', () => {
        console.log('Connected to', peripheral.advertisement.localName);
    });

    peripheral.once('disconnect', () => {
        console.log('Disconnected from', peripheral.advertisement.localName);
    })

    peripheral.once('rssiUpdate', (rssi) => {
        console.log('RSSI updated to', rssi);
    })

    peripheral.once('servicesDiscover', (services) => {
        console.log('Discovered services:', services);
    })

    peripheral.once('includedServicesDiscover', (includedServiceUuids) => {
        console.log('Included services discovered:', includedServiceUuids);
    })

    console.log('Connected to', peripheral.advertisement.localName);

    peripheral.discoverSomeServicesAndCharacteristics([], [], async (error, services, characteristics) => {

        if (error) {
            console.error('Discovery error:', error);
            peripheral.disconnect(); 
            return;
        }

        fs.writeFileSync('services.json', util.inspect(services, { showHidden: false, depth: null }));
        fs.writeFileSync('characteristics.json', util.inspect(characteristics, { showHidden: false, depth: null }));

        const writeCharacteristic = characteristics.find(c => c.uuid === writeCharacteristicUuid);
        const readCharacteristic = characteristics.find(c => c.uuid === readCharacteristicUuid);

        if (!writeCharacteristic) {
            console.error('Write characteristic not found');
            // disconnect
            peripheral.disconnect();
            return;
        }

        if (!readCharacteristic) {
            console.error('Write characteristic not found');
            // disconnect
            peripheral.disconnect();
            return;
        }

        await sendHeartbeatCommand(peripheral, writeCharacteristic, readCharacteristic);
        await getMCUInformation(peripheral, writeCharacteristic, readCharacteristic);
        await requestWorkingMode(peripheral, writeCharacteristic, readCharacteristic);

        let initialData = await readBufferValue(readCharacteristic)

        // read the stored value from the filesystem and compared it to the number of the last value
        try {
            let storedValue = Number(JSON.parse(fs.readFileSync('storedvalue.json')).storedValue)

            console.log(`stored value: ${storedValue}`)

            if (value < storedValue) {

                value = storedValue
            }
        } catch (error) {
            console.log(`error reading stored value from filesystem: ${error}`)
        }

        // brute force sending commands to the device
        while (value < maxValue) {

            // console.log(`value: ${value}`)

            let data = Buffer.alloc(3); // "value" is our brute force value that we're trying to do
            // data.writeUInt32BE(value, 0); // Write the value to the buffer
            data[0] = (value >> 16) & 0xFF;
            data[1] = (value >> 8) & 0xFF;
            data[2] = value & 0xFF;
            
            let buffer = createTuyaCommand(0x06, data); // 0x06 is "SEND COMMANDS"

            if (buffer.length > MTU_SIZE) {
                console.error('Data exceeds MTU size -- review strategy');
                peripheral.disconnect(); 
                return
            }

            await writeBufferValue(writeCharacteristic, buffer)
            
            let newData = await readBufferValue(readCharacteristic)

            console.log(`${value}/${maxValue}:\tinput:${buffer.toString('hex')}\tread:${newData.toString('hex')}`)

            if (newData.toString('hex') !== initialData.toString('hex')) {

                console.log('State has changed, halting brute force -- review go kart');
                console.log(`state was: ${initialData.toString('hex')}`)
                console.log(`state is now: ${newData.toString('hex')}`) 
                peripheral.disconnect();

                return;
            }

            if (value >= maxValue) {
                console.log('Finished brute forcing without change in state -- review strategy');
                peripheral.disconnect(); // Disconnect after finishing the test

                return
            }

            value++;
            // store the last seen value on the filesystem in storedvalue.json:
            fs.writeFileSync('storedvalue.json', JSON.stringify({storedValue: value}, null, 2));

            await new Promise((resolve) => { setTimeout(() => { resolve () }, checkInterval) })
        }
    })
}

const targetDeviceActions = (peripheral) => {

    foundTargetDevice = true
    console.log(`target device actions!`)
    console.log(peripheral)
    console.log(peripheral.advertisement)

    // use util.inspect to get the full peripheral object and write it to a file, without circular refs:
    fs.writeFileSync('peripheral.json', util.inspect(peripheral, { showHidden: false, depth: null }));

    // if (peripheral.uuid === expectedPeripheralUuid) {

        noble.stopScanning();
        console.log('Scan stopped. Target device has been found:', peripheral.advertisement.localName);
        console.log(`connecting to peripheral`)

        peripheral.connect((error) => {

            if (error) {
                console.error('Error connecting to peripheral:', error);
                return;
            }

            console.log(`connected to peripheral`)

            peripheralConnectActions(peripheral)
        });
    // }
}

const discoverPeripheral = (peripheral) => {

    if (skipActions(peripheral)) {

        return
    }

    try {
        console.log(`discovered peripheral. running target device actions.`)

        targetDeviceActions(peripheral)
    } catch (error) {
        console.error(error)
    }
}

noble.on('stateChange', (state) => {
    if (state === 'poweredOn') {
        console.log('Starting BLE scan...');
        noble.startScanning(); // Start scanning
    } else {
        noble.stopScanning();
        console.log('Bluetooth not powered on');
    }
});

noble.on('discover', discoverPeripheral);