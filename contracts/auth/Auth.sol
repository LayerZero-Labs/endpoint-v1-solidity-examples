// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.20;

contract Auth {
    error Unauthorized();
    error WrongRole();

    enum Roles {
        OPERATOR,
        ADMIN
    }

    // Keeps track of all operators
    mapping(address => bool) public operators;

    // Keeps track of all admins
    mapping(address => bool) public admins;

    constructor(address initialAdmin) {
        admins[initialAdmin] = true;
        operators[initialAdmin] = true;
    }

    /*//////////////////////////////////////////////////////////////
                           Access Control Modifiers
    //////////////////////////////////////////////////////////////*/

    modifier onlyAdmin() {
        if (!admins[msg.sender]) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) {
            revert Unauthorized();
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                           Maintenance Functions
    //////////////////////////////////////////////////////////////*/
    function addAdmin(address newAdmin) external onlyAdmin {
        admins[newAdmin] = true;
    }

    function deleteAdmin(address oldAdmin) external onlyAdmin {
        admins[oldAdmin] = false;
    }

    function addOperator(address newOperator) external onlyAdmin {
        operators[newOperator] = true;
    }

    function deleteOperator(address oldOperator) external onlyAdmin {
        operators[oldOperator] = false;
    }
}
