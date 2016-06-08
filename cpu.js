//drawing, break it out into a gpu.js?
var canvas = document.getElementById('chip8');
var ctx = canvas.getContext('2d');

var mem, v, I, dt, st, pc, sp, stack, gfx, drawFlag, interval, currentRom;
var fps = 60;
var keys = {};
var audioctx = new AudioContext;

var keyMap = {
    49: 0x1,
    50: 0x2,
    51: 0x3,
    52: 0x4,
    53: 0x5,
    54: 0x6,
    55: 0x7,
    56: 0x8,
    57: 0x9,
    97: 0xA,
    98: 0xB,
    99: 0xC,
    100: 0xD,
    101: 0xE,
    102: 0xF,
    48: 0x10
};
var roms = [
    "KEYTEST",
    "RANDOM",
    "MAZE",
        "15PUZZLE",
        "BLINKY",
        "BLITZ",
        "BRIX",
        "CONNECT4",
        "GUESS",
        "HIDDEN",
        "INVADERS",
        "KALEID",
        "MERLIN",
        "MISSILE",
        "PONG",
        "PONG2",
        "PUZZLE",
        "SYZYGY",
        "TANK",
        "TETRIS",
        "TICTAC",
        "UFO",
        "VBRIX",
        "VERS",
    "WIPEOFF"
];
function reset() {
    clearInterval(interval);
    document.getElementById("play").disabled = true;
    document.getElementById("pause").disabled = true;
    document.getElementById("reload").disabled = true;
    document.getElementById("restart").disabled = true;
    mem = [ //add font
        0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
        0x20, 0x60, 0x20, 0x20, 0x70, // 1
        0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
        0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
        0x90, 0x90, 0xF0, 0x10, 0x10, // 4
        0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
        0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
        0xF0, 0x10, 0x20, 0x40, 0x40, // 7
        0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
        0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
        0xF0, 0x90, 0xF0, 0x90, 0x90, // A
        0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
        0xF0, 0x80, 0x80, 0x80, 0xF0, // C
        0xE0, 0x90, 0x90, 0x90, 0xE0, // D
        0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
        0xF0, 0x80, 0xF0, 0x80, 0x80 // F
    ];
    for(var i = 0x200; i<4096;i++){
        mem[i]=0;
    }
    gfx = new Array(64);
    for (var x = 0; x < 64; x++) {
        gfx[x] = new Array(32);
        for (var y = 0; y < 32; y++) {
            gfx[x][y] = 0;
        }
    }
    v = [];
    for (var i = 0; i < 16; i++) {
        v[i] = 0;
    }
    I = 0;
    dt = 0;
    st = 0;
    pc = 0x200;
    sp = 0;
    stack = [];
    keys = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height); //Clears itself.
    drawFlag = false;
    romLength = 0;
    debug();
}
//TODO:
//finish remaining opcodes
//split graphics into another file?
//do key input
//get stack working (maybe still not working)

function cycle() {
    var opcode = mem[pc] << 8 | mem[pc + 1];
    var nibble = opcode & 0xF000; //get first character
    console.log("Opcode: " + dec2hex(opcode) + " Nibble:" + dec2hex(nibble));
    //each step is moving 2 bits
    //this needs to be changed, as sometimes they are set differently.
    var xCode = (opcode & 0x0F00) >> 8;
    var yCode = (opcode & 0x00F0) >> 4;
    console.log(xCode + ":" + yCode);
    dt = dt > 0 ? dt - 1 : dt;
    st = st > 0 ? st - 1 : st;
    switch (nibble) {

        case 0x0000:
            switch (opcode & 0x000F) { // 2 opcodes that start with 0, 0nnn can be ignored.
                case 0x0000: //clear the screen 00E0
                    console.log("Clear Display");
                    for (var count = 0; count < 64; count++) {
                        gfx[count] = new Array(32);
                    }
                    drawFlag = true;
                    //displayflag?
                    pc += 2;
                    break;
                case 0x000E: //00EE
                    //Return from a subroutine
                    console.log("Stack: " + stack[sp - 1] + " at sp: " + sp);
                    console.log("Returning from subroutine to: " + dec2hex(stack[sp - 1]));

                    pc = stack[sp - 1];
                    sp--;
                    console.log(stack + " SP: " + sp);
                //sp--;
                //sets PC from top of stack, then sp-=1
                //The interpreter sets the program counter to the
                //address at the top of the stack, then subtracts 1 from the stack pointer.
            }
            break;
        case 0x1000: //1nnn
            console.log("Jumping to: " + dec2hex(opcode & 0x0FFF));
            pc = opcode & 0x0FFF;
            break;
        case 0x2000: //2nnn
            console.log("Calling subroutine at: " + dec2hex(opcode & 0x0FFF));
            console.log("Storing positon: " + dec2hex(pc));

            stack[sp] = pc;
            sp++;
            pc = opcode & 0x0FFF;
            console.log(stack + " SP: " + sp);
            //increment stack pointer, put current PC on top of stack, then change PC to nnn
            break;
        case 0x3000: //3xkk
            //skip next instruction if register x is equal to kk.
            //Increment by 4, not 2.
            console.log("Checking if V" + xCode + " equals kk:" + dec2hex(opcode & 0x00FF));
            if (v[xCode] === (opcode & 0x00FF)) {
                console.log("Equals, so skipping");
                pc += 4;
            } else {
                pc += 2
            }
            break;
        case 0x4000: //4xkk
            //skip next instruction if register x is not equal to kk
            //Increment by 4, not 2.
            console.log("Checking if V" + xCode + " not equals kk:" + dec2hex(opcode & 0x00FF));
            if (v[xCode] != (opcode & 0x00FF)) {
                console.log("Not Equals, so skipping");
                pc += 4;
            } else {
                pc += 2
            }
            break;
        case 0x5000: //5xy0
            //skip next instruction if registry x equals registry y
            //Increment by 4, not 2.
            console.log("Checking if V" + xCode + " equals V" + dec2hex(opcode & 0x00F0));
            if (v[xCode] == v[yCode]) {
                console.log("Equals, so skipping");
                pc += 4;
            } else {
                pc += 2
            }
            break;
        case 0x6000: //6xkk
            //put value kk into register x;
            console.log("Putting kk: " + dec2hex(opcode & 0x00FF) + "(" + (opcode & 0x00FF) + ") into V" + xCode);
            v[xCode] = opcode & 0x00FF;
            pc += 2;
            break;
        case 0x7000: //7xkk
            //adds the value kk to the value of register x, then stores result in x again.
            console.log("Adding kk: " + dec2hex(opcode & 0x00FF) + "(" + (opcode & 0x00FF) + ") to V" + dec2hex(xCode));
            var result = (opcode & 0x00FF) + v[xCode];
            if (result > 255) {
                result -= 256;
            }
            v[xCode] = result;
            pc += 2;
            break;
        case 0x8000:
            switch (opcode & 0x000F) { // 2 opcodes that start with 0, 0nnn can be ignored.
                case 0x0000: //8xy0
                    //Set Vx = Vy.
                    console.log("Setting V" + xCode + " to value of V" + yCode);
                    v[xCode] = v[yCode];
                    break;
                case 0x0001: //8xy1
                    //Set Vx = Vx OR Vy.
                    console.log("ORing V" + xCode + " and V" + yCode);
                    v[xCode] |= v[yCode];
                    break;
                case 0x0002: //8xy2

                    //Set Vx = Vx AND Vy.
                    console.log("ANDing V" + xCode + " and V" + yCode);
                    v[xCode] &= v[yCode];
                    break;
                case 0x0003: //8xy3

                    //Set Vx = Vx XOR Vy.
                    console.log("XORing V" + xCode + " and V" + yCode);
                    v[xCode] ^= v[yCode]; //XOR
                    break;
                case 0x0004: //8xy4
                    //Set Vx = Vx + Vy, set VF = carry.
                    //not correct. If Vx + Vy >255, carry. Keep lowest 8 bits. (does that mean setting to 255?)
                    v[xCode] = v[xCode] + v[yCode];
                    v[0xF] = 1;
                    break;
                case 0x0005: //8xy5
                    //Set Vx = Vx - Vy, set VF = NOT borrow.
                    console.log("Subtracting?");
                    if (v[xCode] > v[yCode]) {
                        v[0xF] = 1
                    } else { //probably a better way to do this.
                        v[0xF] = 0
                    }
                    v[xCode] -= v[yCode];
                    break;
                case 0x0006: //8xy6
                    var lsb = v[xCode] & 1;
                    v[0xF] = lsb;
                    v[xCode] >>= 1;

                    //LSB == last number
                    //Set Vx = Vx SHR 1.
                    break;
                case 0x0007: //8xy7
                    //Set Vx = Vy - Vx, set VF = NOT borrow.
                    console.log("Set Vx = Vy - Vx, set VF = NOT borrow.");
                    if (v[xCode] < v[yCode]) {
                        v[0xF] = 1
                    } else { //probably a better way to do this.
                        v[0xF] = 0
                    }
                    v[xCode] = v[yCode] - v[xCode];
                    break;
                case 0x000E: //8xyE
                    ////Set Vx = Vx SHL 1.
                    var MSB = (v[xCode] & 0xFF) >> 7;
                    v[0xF] = MSB;
                    v[xCode] <<= 1;
                    if (v[xCode] > 255) {
                        v[xCode] -= 256;
                    }
                    //break;
            }
            pc += 2;
            break;
        case 0x9000: //9xy0
            //Skip next instruction if Vx != Vy.
            console.log("Checking if V" + xCode + " not equals V" + yCode);
            if (v[xCode] != v[yCode]) {
                console.log("Not Equals, so skipping");
                pc += 4;
            } else {
                pc += 2
            }
            break;
        case 0xA000: //Annn
            // set I = nnn
            console.log("Setting I to " + dec2hex(opcode & 0x0FFF));
            I = opcode & 0x0FFF;
            pc += 2;
            break;
        case 0xB000: //Bnnn
            //Jump to location nnn+V0
            pc = (opcode & 0x0FFF) + v[0];
            break;
        case 0xC000: //cxkk
            //set Vx = random byte and kk.
            //gen random number 0 to 255, AND with KK, store in Vx

            var random = Math.floor(Math.random() * 255);
            console.log("Randomly generated " + random + ". AND with kk: " + dec2hex(opcode & 0x00FF) + ". Result is: " + dec2hex(random & (opcode & 0x00FF)));
            v[xCode] = random & (opcode & 0x00FF);
            pc += 2;
            break;
        case 0xD000: //Dxyn
            //display
            //Dxyn - DRW Vx, Vy, nibble
            //Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.
            v[0xF] = 0;
            var regX = v[xCode];
            var regY = v[yCode];
            console.log(opcode & 0x00F0);
            for (var y = 0; y < (opcode & 0x000F); y++) {
                //draw row by row.
                //rows are always 8 long.


                var row = mem[I + y]; //XOR with what's on display
                for (var x = 0; x < 8; x++) {
                    if ((row & 0x80) > 0) {
                        if (setPixel(regX + x, regY + y)) {
                            v[0xF] = 1;
                        }
                    }
                    row <<= 1;
                }
                //have draw pixel moved to another function that returns boolean on collision?

            }
            drawFlag = true;
            pc += 2;
            break;
        case 0xE000: //key-based stuff
            switch (opcode & 0x000F) {
                case 0x000E: //Ex9E
                    //Skip next instruction if key with the value of Vx is pressed.
                    console.log("Checking for key " + dec2hex(v[xCode]));
                    if (keys[v[xCode]]) {
                        pc += 4;
                        console.log("Key Found");
                    } else {
                        pc += 2
                    }

                    break;
                case 0x0001: //ExA1
                    //Skip next instruction if key with the value of Vx is NOT pressed.
                    console.log("Checking for not key " + dec2hex(v[xCode]));
                    if (!keys[v[xCode]]) {
                        pc += 4;
                        console.log("Key Not Found");
                    } else {
                        pc += 2
                    }
                    break;
            }
            break;
        case 0xF000:
            switch (opcode & 0x00FF) {
                case 0x0007: //Fx07
                    //Set Vx = delay timer value.

                    v[xCode] = dt;
                    pc += 2;
                    break;
                case 0x000A: //Fx0A
                    //Wait for a key press, store the value of the key in Vx.
                    console.log("Supposed to pause and wait for key input");
                    pause();
                    break;

                case 0x0015: //Fx15
                    //Set delay timer = Vx.
                    console.log("Set DT to " + dec2hex(v[xCode]));
                    dt = v[xCode];
                    pc += 2;
                    break;

                case 0x0018: //Fx18

                    //Set sound timer = Vx..
                    console.log("Set ST to " + dec2hex(v[xCode]));
                    st = v[xCode];
                    pc += 2;
                    break;

                case 0x001E: //Fx1E
                    //Set I = I + Vx.
                    I += v[xCode];
                    pc += 2;
                    break;

                case 0x0029: //Fx29
                    //Set I = location of sprite for digit Vx. (Font)
                    I = (v[xCode] * 5); //may work?
                    pc += 2;
                    break;

                case 0x0033: //Fx33
                    //Store BCD representation of Vx in memory locations I, I+1, and I+2.
                    //console.log("Storing BCD: " + v[xCode].toString()[0] + ", " + v[xCode].toString()[1] + ", " + v[xCode].toString()[2])
                    var num = v[xCode].toString();
                    for(var strLen = num.length;strLen>0;strLen--){
                        mem[I+3-strLen] = num[0]; //strLen = 2, I+3
                        console.log(num[0]+" put in "+parseInt(I+3-strLen));
                        num = num.slice(1);
                    }

                    pc += 2;
                    break;

                case 0x0055: //Fx55
                    //Store registers V0 through Vx in memory starting at location I.
                    console.log("Storing V0 through V" + xCode);
                    for (var x = 0; x < (xCode); x++) {
                        mem[I + x] = v[x];
                    }
                    pc += 2;
                    break;

                case 0x0065: //Fx65
                    //Read registers V0 through Vx from memory starting at location I.
                    console.log("Reading V0 through V" + xCode);
                    for (var x = 0; x <= (xCode); x++) {
                        v[x] = mem[I + x];
                    }
                    pc += 2;
                    break;
            }
    }
}

//get opcode
//find  meaning
//execute meaning
function getSelected() {
    var select = document.getElementById("program");
    return select.options[select.selectedIndex].text;
}
function loadRemoteRom(file) {

    var reader = new FileReader();

    reader.onload = function (e) {
        var rom = new Uint8Array(reader.result);
        loadRom(rom)
    };

    reader.readAsArrayBuffer(file);
    console.log(file);
}
function setRomList(){
    var programSelect = document.getElementById("program");
    roms.forEach(function(entry){
        var option = document.createElement("option");
        option.text = entry;
        programSelect.add(option);
    });

}
var romLength = 0;

function loadLocalRom() {
    // Load a rom.
    var xhr = new XMLHttpRequest;
    xhr.open("GET", "roms/" + getSelected(), true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function () {
        var rom = new Uint8Array(xhr.response);
        loadRom(rom)
    };
    xhr.send();
}
function reloadRom() {
    loadRom(currentRom);
}
function loadRom(rom) {
    reset();
    document.getElementById("play").disabled = true;
    currentRom = rom;
    console.log(rom.length);
    romLength = rom.length;
    for (var i = 0, len = rom.length; i < len; i++) {
        mem[0x200 + i] = rom[i];
    }
    console.log("Loaded");
    debug();
    document.getElementById("play").disabled = false;
    document.getElementById("reload").disabled = false;
    document.getElementById("restart").disabled = false;
}
function draw() { //should have debug on side of screen.
    console.log("drawing");
    ctx.clearRect(0, 0, canvas.width, canvas.height); //clears canvas
    for (var x = 0; x < 64; x++) {
        for (var y = 0; y < 32; y++) {
            if (gfx[x][y] == 1) {
                ctx.fillRect(x * 10, y * 10, 10, 10);
                ctx.stroke();
            }
        }
    }
}

function setPixel(x, y) {
    console.log("Setting X: " + x + " Y: " + y);
    if (x > 64) {
        x -= 64;
    } else if (x < 0) {
        x += 64;
    }
    if (y > 32) {
        y -= 32;
    } else if (y < 0) {
        y += 32;
    }
    gfx[x][y] ^= 1;
    return !gfx[x][y];
}

function dec2hex(i) {

    return "0x" + (i + 0x100000).toString(16).substr(-4).toUpperCase();
}
function dec2hexShort(i) {

    return "0x" + (i + 0x1000).toString(16).substr(-2).toUpperCase();
}//add another that just has decimal?
function loop() { //should be infinite.


    cycle();

    debug();
    if (drawFlag) {
        drawFlag = false;
        draw();
    }
    if (st > 0) {
        beep();
    } else {
    }
}

document.addEventListener("keydown", onKeyDown, false);
document.addEventListener("keyup", onKeyUp, false);
function onKeyDown(event) {
    console.log(event.keyCode + " : " + keyMap[event.keyCode]);
    keys[keyMap[event.keyCode]] = true;
    console.log(keys);
}
function onKeyUp(event) {
    console.log(event.keyCode + " : " + keyMap[event.keyCode]);
    keys[keyMap[event.keyCode]] = false;
    console.log(keys);
}

function beep() {
    var oscillator = audioctx.createOscillator();
    oscillator.frequency.value = 400;

    oscillator.connect(audioctx.destination);

    oscillator.start(0);
    setTimeout(function () {
        oscillator.stop()
    }, 150);
}
function setFPS(set) { // will be used.
    fps = set;
    if (document.getElementById("play").disabled) {
        clearInterval(interval);
        interval = setInterval(loop, 1000 / fps);
    }
}
function pause() {
    clearInterval(interval);
    document.getElementById("play").disabled = false;
    document.getElementById("pause").disabled = true;
}

function debug() {
    document.getElementById("iReg").innerHTML = dec2hex(I) + " (" + I + ")";
    document.getElementById("delayTimer").innerHTML = dt;
    document.getElementById("soundTimer").innerHTML = st;
    document.getElementById("pcReg").innerHTML = dec2hex(pc)+" ("+dec2hex(mem[pc] << 8 | mem[pc + 1])+")";
    document.getElementById("spReg").innerHTML = sp;
    document.getElementById("reg").innerHTML = "";
    for (var i = 0; i < 16; i++) {
        document.getElementById("reg").innerHTML += "V" + i + ": " + dec2hex(v[i]) + " (" + v[i] + ")<br>";
    }
    document.getElementById("rom").innerHTML = "";
    var memDebug = "";
    for (var i = 0x200; i < mem.length; i++) {
        memDebug += dec2hex(i) + ": " + dec2hexShort(mem[i]) + "<br>";
    }
    //document.getElementById("rom").innerHTML=memDebug;
}
function restart() {
    reloadRom();
    play();
}
function play() {
    interval = setInterval(loop, 1000 / fps);
    draw(); //60fps. Double check if cycling should actually be at 60hz, or just timers.
    document.getElementById("play").disabled = true;

    document.getElementById("pause").disabled = false;
}
document.getElementById("fps").addEventListener("input", function (e) {
    setFPS(document.getElementById("fps").value);
});
setRomList();
loadLocalRom();

//var interval = setInterval(loop, 1000 / 60);