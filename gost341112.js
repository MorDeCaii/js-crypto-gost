function addXor512(a, b) {
    let res = new Uint8Array(BLOCK_SIZE);
    for (let i = 0; i < BLOCK_SIZE; i++) {
        res[i] = a[i] ^ b[i];
    }
    return res;
}

function addMod512(a, b) {
    let res = new Uint8Array(64);
    let tmp = 0;
    let tmpA = new Uint8Array(64);
    let tmpB = new Uint8Array(64);

    for (let i = 0; i < a.length; i++) tmpA[63-i] = a[a.length-i-1];
    for (let i = 0; i < b.length; i++) tmpB[63-i] = b[b.length-i-1];

    for (let i = 63; i >= 0; i--) {
        tmp = tmpA[i] + tmpB[i] + (tmp >> 8);
        res[i] = tmp & 0xff;
    }
    return res;
}

function P(state) {
    let res = new Uint8Array(BLOCK_SIZE);
    for (let i = 0; i < BLOCK_SIZE; i++) {
        res[i] = state[PBOX[i]];
    }
    return res;
}

function S(state) {
    let res = new Uint8Array(BLOCK_SIZE);
    for (let i = 0; i < BLOCK_SIZE; i++) {
        res[i] = SBOX[state[i]];
    }
    return res;
}

function L(state) {
    let res = new Uint8Array(BLOCK_SIZE);
    for (let i = 0; i < 8; i++) {
        let parts = new Uint32Array(2);
        let tmpArr = new Uint8Array(8);
        tmpArr = state.slice(i*8, i*8 + 8);
        tmpArr.reverse();

        for (let j = 0; j < 8; j++) {
            for (let k = 0; k < 8; k++) {
                if ((tmpArr[7-j] >> 7-k) & 1) {
                    parts[0] ^= A[j*16 + k*2];
                    parts[1] ^= A[j*16 + k*2 + 1];
                }
            }
        }

        res[i * 8] = parts[0] >> 24;
        res[i * 8 + 1] = (parts[0] << 8) >> 24;
        res[i * 8 + 2] = (parts[0] << 16) >> 24;
        res[i * 8 + 3] = (parts[0] << 24) >> 24;
        res[i * 8 + 4] = parts[1] >> 24;
        res[i * 8 + 5] = (parts[1] << 8) >> 24;
        res[i * 8 + 6] = (parts[1] << 16) >> 24;
        res[i * 8 + 7] = (parts[1] << 24) >> 24;
    }
    return res;
}

function keySchedule(k, i) {
    let res = k;
    res = addXor512(res, C[i]);
    res = S(res);
    res = P(res);
    res = L(res);
    return res;
}

function E(k, m) {
    let state = addXor512(k, m);
    for (let i = 0; i < 12; i++) {
        state = S(state);
        state = P(state);
        state = L(state);
        k = keySchedule(k, i);
        state = addXor512(state, k);
    }
    return state;
}

function GN(n, h, m) {
    let k = addXor512(h, n);
    k = S(k);
    k = P(k);
    k = L(k);
    //console.log(k);
    let tmp = E(k, m);
    tmp = addXor512(tmp, h);
    let newH = addXor512(tmp, m);
    return newH;
}

function hash(message, size) {
    let paddedMsg = new Uint8Array(BLOCK_SIZE);
    let h = new Uint8Array(BLOCK_SIZE);
    let len = message.length;
    let n = new Uint8Array(BLOCK_SIZE).fill(0);
    let sigma = new Uint8Array(BLOCK_SIZE).fill(0);

    if (size === 512) h = iv512;
    else h = iv256;

    let n512 = new Uint8Array([0, 0, 2, 0]); // byte representation of 512
    let inc = 0;
    while (len >= BLOCK_SIZE) {
        inc++;
        let tmpMsg = new Uint8Array(BLOCK_SIZE);
        let pos = message.length - inc * BLOCK_SIZE;
        tmpMsg = message.slice(pos, pos + BLOCK_SIZE);
        h = GN(n, h, tmpMsg);
        n = addMod512(n, n512);
        sigma = addMod512(sigma, tmpMsg);
        len -= BLOCK_SIZE;
    }

    let msg = new Uint8Array(message.length - inc*64);
    msg = message.slice(0, message.length - inc*64);
    if (msg.length < BLOCK_SIZE) {
      for (let i = 0; i < (BLOCK_SIZE - msg.length - 1); i++) {
        paddedMsg[i] = 0;
      }
      paddedMsg[BLOCK_SIZE - msg.length - 1] = 0x01;
      for (let i = 0; i < msg.length; i++) {
        paddedMsg[BLOCK_SIZE - msg.length + i] = msg[i];
      }
    }
    h = GN(n, h, paddedMsg);
    let msgLen = new Uint8Array(4);
    for (let i = 0; i < 4; i++) {
        msgLen[i] = ([msg.length*8] >> i*8) & 255;
    }
    n = addMod512(n, msgLen.reverse());
    sigma = addMod512(sigma, paddedMsg);
    h = GN(N_0, h, n);
    h = GN(N_0, h, sigma);

    if (size == 512) return h;
    else return h.slice(0, 32);
}

