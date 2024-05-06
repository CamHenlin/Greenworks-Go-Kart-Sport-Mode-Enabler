# Greenworks Go Kart Sport Mode Enabler

## Overview

Greenworks Go Kart Sport Mode Enabler is an application that I built out of frustration after recently purchasing my kids a Greenworks 60V STEALTH Go Kart. The Go Kart is neat but its "sport mode" required connecting to the Go Kart via Bluetooth and enabling it through the Greenworks "SMARTg home" app. The app was buggy and would not connect to the kart. I found after reading online, that there were countless other frustrated people having the same issue. 

## Technical Details and Background

Essentially the strategy in creating this app, early on, was that I intended to create an application that would connect to the kart via bluetooth low energy, and then brute force bluetooth low energy commands at the kart until something happened or sport mode turned on. After getting connected and researching some of the unique identifiers that the kart was outputting, I determined that the kart was using some dialect of the Tuya smart home protocol. So I proceeded with brute forcing the smaller tuya command space once connected to the app, which I calculated might take about 16 days total. After about 2 days and 3 bluetooth disconnects, I retried using the "SMARTg home" app and following Greenworks' instructions to connect the kart to the app. After doing this, I was able to connect to the kart and enable sport mode.

## Usage

To run the Bluetooth Kart Controller application, follow these steps. Honestly, I don't know what step to stop at and retry connecting with the Greenworks "SMARTg home" app, and I am not able to put my kart in a state where it no longer works. So please feel free to retry before I did in my steps here and let me know what your findings are:

- Ensure your Greenworks 60V Go Kart is powered on and in range for Bluetooth connectivity. The Bluetooth logo on the kart should be off for this app to connect.
- Mac users: download "bluetoothkart.zip" from this repository. Unzip it and double click on the "bluetoothkart" terminal application.
- Windows users will need to download via source code and run the application using node.js. I will provide an executable soon
- The app will begin searching for the kart. It should eventually connect and will start cycling through commands that look like this:

```
x/16777215:        input:55aa0603000a140127        read:0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 
```

- NOTE: I kind of wonder if you could stop here and try connecting now. It is not harmful to kill the app and try the setup procedure with the Greenworks app.
- eventually, the kart will disconnect. For me this took several hours. The bluetooth logo will disappear from the screen on the kart, and there will be a message stating "Disconnected from GLW".
- Mine disconnected at 55aa0603000a78dd67, 55aa0603000a140127, 55aa0603000b9622cb NOTE: I kind of wonder if you could stop after each one of these and try connecting. It is not harmful to kill the app and try the setup procedure with the Greenworks app.
- After mine disconnected those 3 times, I redid the Greenworks procedure exactly: 
- use the SMARTg app. I used an iphone 15 pro on latest iOS with latest app.
- have the app on the add device page
- with the kart off, hold the brake down (make sure the brake lights come on brighter! adjust the switch under the brake pedal if necessary)
- while still holding the brake count to ten out loud (I did the ol', "one-one-thousand, two-two-thousand,...")
- while still holding the brake, press and hold the power button -- continue holding both while the kart turns on
- stare at the app, after the kart finishes its start up sequence, it will appear at the top of the screen in the app... you shouldn't need to select the go kart icon for adding a go kart, the kart itself should just appear at the top of the screen (just like in the youtube video)
- you can release the brake now, you should be all set up in the app

That's it! you should now be able to switch between eco and sport mode. 

## Next Steps

Firstly, let me know if you make any findings -- especially if you can pair earlier in the steps that I outlined above. I will update the instructions accordingly. 

Next, I will work on getting a Windows executable built so folks on windows computers don't need to build from source.

Last, since we can now get the kart working, I believe it would be possible to capture the bluetooth commands that the app sends to the kart and build an application that simply connects to the kart, and either enables or disables sport mode. I will look into this more especially since I fear the app failing to work in the future.

## Feedback

Please send me any notes or feedback! Feel free to open an issue or pull request. 