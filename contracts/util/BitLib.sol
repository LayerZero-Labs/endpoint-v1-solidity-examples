// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.5.0;

// mostSignificantBitPosition taken from: https://github.com/Uniswap/solidity-lib/blob/master/contracts/libraries/BitMath.sol
// countSetBits based off: https://en.wikipedia.org/wiki/Hamming_weight

library BitLib {

    uint256 constant m1  = 0x5555555555555555555555555555555555555555555555555555555555555555;
    uint256 constant m2  = 0x3333333333333333333333333333333333333333333333333333333333333333;
    uint256 constant m4  = 0x0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F;
    uint256 constant m8  = 0x00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF;
    uint256 constant m16 = 0x0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF;
    uint256 constant m32 = 0x00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF;
    uint256 constant m64 = 0x0000000000000000FFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF;
    uint256 constant m128= 0x00000000000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

    function mostSignificantBitPosition(uint256 x) internal pure returns (uint8 r) {
        if(x == 0) return 0;

        if (x >= 0x100000000000000000000000000000000) {
            x >>= 128;
            r += 128;
        }
        if (x >= 0x10000000000000000) {
            x >>= 64;
            r += 64;
        }
        if (x >= 0x100000000) {
            x >>= 32;
            r += 32;
        }
        if (x >= 0x10000) {
            x >>= 16;
            r += 16;
        }
        if (x >= 0x100) {
            x >>= 8;
            r += 8;
        }
        if (x >= 0x10) {
            x >>= 4;
            r += 4;
        }
        if (x >= 0x4) {
            x >>= 2;
            r += 2;
        }
        if (x >= 0x2) r += 1;
    }

    function countSetBits(uint x) internal pure returns (uint256) {
        x = (x & m1 ) + ((x >>  1) & m1 );
        x = (x & m2 ) + ((x >>  2) & m2 );
        x = (x & m4 ) + ((x >>  4) & m4 );
        x = (x & m8 ) + ((x >>  8) & m8 );
        x = (x & m16) + ((x >> 16) & m16);
        x = (x & m32) + ((x >> 32) & m32);
        x = (x & m64) + ((x >> 64) & m64);
        x = (x & m128) + ((x >> 128) & m128);
        return x;
    }
}