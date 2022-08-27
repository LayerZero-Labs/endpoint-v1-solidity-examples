// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

contract Queue {
    mapping(uint => uint) public queue;
    uint256 public first = 1;
    uint256 public last = 0;

    function enqueue(uint data) external {
        last += 1;
        queue[last] = data;
    }

    function dequeue() external returns (uint data) {
        require(last >= first, "Queue is Empty");
        data = queue[first];
        delete queue[first];
        first += 1;
    }
}