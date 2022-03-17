///@author Pickle
///@notice This contract adds liquidity to solidily pools using FTM or any ERC20 Token and then adds this lp token to desired jar in a single txn.
// SPDX-License-Identifier: GPL-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "@uniswap/lib/contracts/libraries/Babylonian.sol";
import "./lib/solidly/IBaseV1Pair.sol";
import "./lib/solidly/IBaseV1Factory.sol";
import "./lib/solidly/IBaseV1Router01.sol";


interface IPickleJar {
    function token() external view returns (address);

    function deposit(uint256 amount) external;
}

abstract contract ZapBaseV2 is Ownable {
    using SafeERC20 for IERC20;
    bool public stopped = false;
    // swapTarget => approval status
    mapping(address => bool) public approvedTargets;

    // circuit breaker modifiers
    modifier stopInEmergency() {
        if (stopped) {
            revert("Temporarily Paused");
        } else {
            _;
        }
    }

    function _getBalance(address token)
        internal
        view
        returns (uint256 balance)
    {
        if (token == address(0)) {
            balance = address(this).balance;
        } else {
            balance = IERC20(token).balanceOf(address(this));
        }
    }

    function _approveToken(address token, address spender) internal {
        IERC20 _token = IERC20(token);
        if (_token.allowance(address(this), spender) > 0) return;
        else {
            _token.safeApprove(spender, type(uint256).max);
        }
    }

    function _approveToken(
        address token,
        address spender,
        uint256 amount
    ) internal {
        IERC20 _token = IERC20(token);
        _token.safeApprove(spender, 0);
        _token.safeApprove(spender, amount);
    }

    // - to Pause the contract
    function toggleContractActive() public onlyOwner {
        stopped = !stopped;
    }

    function setApprovedTargets(
        address[] calldata targets,
        bool[] calldata isApproved
    ) external onlyOwner {
        require(targets.length == isApproved.length, "Invalid Input length");

        for (uint256 i = 0; i < targets.length; i++) {
            approvedTargets[targets[i]] = isApproved[i];
        }
    }

    receive() external payable {
        require(msg.sender != tx.origin, "Do not send ETH directly");
    }
}

contract Pickle_UniV2_ZapIn_V1 is ZapBaseV2 {
    using SafeERC20 for IERC20;

    uint256 private constant deadline =
        0xf000000000000000000000000000000000000000000000000000000000000000;

    address public wethTokenAddress;

    constructor(address[] memory targets, address wnative)
    {
        for (uint256 i = 0; i < targets.length; i++) {
            approvedTargets[targets[i]] = true;
        }

        wethTokenAddress = wnative;
    }

    event zapIn(address sender, address jar, uint256 tokensRec);

    /**
    @notice This function is used to invest in given soldily jar through ETH/ERC20 Tokens
    @param _FromTokenContractAddress The ERC20 token used for investment (address(0x00) if ether)
    @param _amount The amount of fromToken to invest
    @param _pairAddress The pair address or the PJar token
    @param _toPJar Pickle vault address
    @param _minPJarTokens The minimum acceptable quantity vault tokens to receive. Reverts otherwise
    @param _swapTarget Excecution target for the first swap
    @param _swapData DEX quote data
    @param _transferResidual Set false to save gas by donating the residual remaining after a Zap
    @param _soldilyRouter Protocol's soldily router address
    @param _shouldSellEntireBalance Checks the total allowance of input token to zapin instead of the _amount, if true
    @return tokensReceived Quantity of Vault tokens received
     */
    function ZapIn(
        address _FromTokenContractAddress,
        uint256 _amount,
        address _pairAddress,
        address _toPJar,
        uint256 _minPJarTokens,
        address _swapTarget,
        bytes calldata _swapData,
        bool _transferResidual,
        address _soldilyRouter,
        bool _shouldSellEntireBalance
    ) external payable stopInEmergency returns (uint256 tokensReceived) {
        uint256 _toInvest = _pullTokens(
            _FromTokenContractAddress,
            _amount,
            _shouldSellEntireBalance
        );

        uint256 LPBought = _performZapIn(
            _FromTokenContractAddress,
            _pairAddress,
            _toInvest,
            _swapTarget,
            _swapData,
            _transferResidual,
            _soldilyRouter
        );

        tokensReceived = _vaultDeposit(LPBought, _toPJar, _minPJarTokens);
    }

    function _pullTokens(
        address _from,
        uint256 _amount,
        bool _shouldSellEntireBalance
    ) internal returns (uint256) {
        if (_from != address(0)) {
            require(_amount > 0, "Invalid token amount");
            require(msg.value == 0, "Eth sent with token");

            //transfer token
            if (_shouldSellEntireBalance) {
                require(
                    Address.isContract(msg.sender),
                    "ERR: shouldSellEntireBalance is true for EOA"
                );
                _amount = IERC20(_from).allowance(msg.sender, address(this));
            }
            IERC20(_from).safeTransferFrom(msg.sender, address(this), _amount);
        }
        return _amount;
    }

    function _vaultDeposit(
        uint256 amount,
        address toVault,
        uint256 minTokensRec
    ) internal returns (uint256 tokensReceived) {
        address underlyingVaultToken = IPickleJar(toVault).token();

        _approveToken(underlyingVaultToken, toVault);

        uint256 iniYVaultBal = IERC20(toVault).balanceOf(address(this));
        IPickleJar(toVault).deposit(amount);
        tokensReceived =
            IERC20(toVault).balanceOf(address(this)) -
            iniYVaultBal;
        require(tokensReceived >= minTokensRec, "Err: High Slippage");

        IERC20(toVault).safeTransfer(msg.sender, tokensReceived);
        emit zapIn(msg.sender, toVault, tokensReceived);
    }

    function _getPairTokens(address _pairAddress)
        internal
        view
        returns (address token0, address token1)
    {
        IBaseV1Pair solidlyBasePair = IBaseV1Pair(_pairAddress);
        token0 = solidlyBasePair.token0();
        token1 = solidlyBasePair.token1();
    }

    function _performZapIn(
        address _FromTokenContractAddress,
        address _pairAddress,
        uint256 _amount,
        address _swapTarget,
        bytes memory swapData,
        bool transferResidual,
        address _solidlyRouter
    ) internal returns (uint256) {
        uint256 intermediateAmt;
        address intermediateToken;
        (address _TosolidlyToken0, address _TosolidlyToken1) = _getPairTokens(
            _pairAddress
        );

        if (
            _FromTokenContractAddress != _TosolidlyToken0 &&
            _FromTokenContractAddress != _TosolidlyToken1
        ) {
            // swap to intermediate
            (intermediateAmt, intermediateToken) = _fillQuote(
                _FromTokenContractAddress,
                _pairAddress,
                _amount,
                _swapTarget,
                swapData
            );
        } else {
            intermediateToken = _FromTokenContractAddress;
            intermediateAmt = _amount;
        }

        bool stable = IBaseV1Pair(_pairAddress).stable();

        // divide intermediate into appropriate amount to add liquidity
        (uint256 token0Bought, uint256 token1Bought) = _swapIntermediate(
            intermediateToken,
            _TosolidlyToken0,
            _TosolidlyToken1,
            intermediateAmt,
            _solidlyRouter,
            stable
        );

        return
            _uniDeposit(
                _TosolidlyToken0,
                _TosolidlyToken1,
                token0Bought,
                token1Bought,
                transferResidual,
                _solidlyRouter,
                stable
            );
    }

    function _uniDeposit(
        address _ToSolidlyPoolToken0,
        address _ToSolidlyPoolToken1,
        uint256 token0Bought,
        uint256 token1Bought,
        bool transferResidual,
        address _solidlyRouter,
        bool stable
    ) internal returns (uint256) {
        _approveToken(_ToSolidlyPoolToken0, _solidlyRouter, token0Bought);
        _approveToken(_ToSolidlyPoolToken1, _solidlyRouter, token1Bought);

        (uint256 amountA, uint256 amountB, uint256 LP) = IBaseV1Router01(
            _solidlyRouter
        ).addLiquidity(
                _ToSolidlyPoolToken0,
                _ToSolidlyPoolToken1,
                stable,
                token0Bought,
                token1Bought,
                1,
                1,
                address(this),
                deadline
            );

        if (transferResidual) {
            //Returning Residue in token0, if any.
            uint256 memory balToken0 = IERC20(_ToSolidlyPoolToken0).balanceOf(address(this));
            if (token0Bought - amountA > 0) {
                IERC20(_ToSolidlyPoolToken0).safeTransfer(
                    msg.sender,
                    balToken0
                );
            }

            //Returning Residue in token1, if any
            uint256 memory balToken1 = IERC20(_ToSolidlyPoolToken1).balanceOf(address(this));
            if (token1Bought - amountB > 0) {
                IERC20(_ToSolidlyPoolToken1).safeTransfer(
                    msg.sender,
                    balToken1
                );
            }
        }

        return LP;
    }

    function _fillQuote(
        address _fromTokenAddress,
        address _pairAddress,
        uint256 _amount,
        address _swapTarget,
        bytes memory swapData
    ) internal returns (uint256 amountBought, address intermediateToken) {
        if (_swapTarget == wethTokenAddress) {
            require(_amount > 0 && msg.value == _amount, "Invalid _amount: Input ETH mismatch");
            IWETH(wethTokenAddress).deposit{ value: _amount }();
            return (_amount, wethTokenAddress);
        }

        uint256 valueToSend;
        if (_fromTokenAddress == address(0)) {
            require(_amount > 0 && msg.value == _amount, "Invalid _amount: Input ETH mismatch");
            valueToSend = _amount;
        } else {
            _approveToken(_fromTokenAddress, _swapTarget, _amount);
        }

        (address _token0, address _token1) = _getPairTokens(_pairAddress);
        IERC20 token0 = IERC20(_token0);
        IERC20 token1 = IERC20(_token1);
        uint256 initialBalance0 = token0.balanceOf(address(this));
        uint256 initialBalance1 = token1.balanceOf(address(this));

        require(approvedTargets[_swapTarget], "Target not Authorized");
        (bool success, ) = _swapTarget.call{value: valueToSend}(swapData);
        require(success, "Error Swapping Tokens 1");

        uint256 finalBalance0 = token0.balanceOf(address(this)) -
            initialBalance0;
        uint256 finalBalance1 = token1.balanceOf(address(this)) -
            initialBalance1;

        if (finalBalance0 > finalBalance1) {
            amountBought = finalBalance0;
            intermediateToken = _token0;
        } else {
            amountBought = finalBalance1;
            intermediateToken = _token1;
        }

        require(amountBought > 0, "Swapped to Invalid Intermediate");
    }

     function _swapIntermediate(
        address _toContractAddress,
        address _ToUnipoolToken0,
        address _ToUnipoolToken1,
        uint256 _amount,
        address _solidlyRouter,
        bool _stable
    ) internal returns (uint256 token0Bought, uint256 token1Bought) {
        IBaseV1Factory solidlyFactory = IBaseV1Factory(
            IBaseV1Router01(_solidlyRouter).factory()
        );

        address pairAddress = solidlyFactory.getPair(_ToUnipoolToken0, _ToUnipoolToken1, _stable);

        (uint256 res0, uint256 res1, ) = IBaseV1Pair(pairAddress).getReserves();

        if (_toContractAddress == _ToUnipoolToken0) {
            uint256 amountToSwap = calculateSwapInAmount(res0, _amount);
            //if no reserve or a new pair is created
            if (amountToSwap <= 0) amountToSwap = _amount / 2;
            token1Bought = _token2Token(
                _toContractAddress,
                _ToUnipoolToken1,
                amountToSwap,
                _solidlyRouter,
                solidlyFactory,
                _stable
            );
            token0Bought = _amount - amountToSwap;
        } else {
            uint256 amountToSwap = calculateSwapInAmount(res1, _amount);
            //if no reserve or a new pair is created
            if (amountToSwap <= 0) amountToSwap = _amount / 2;
            token0Bought = _token2Token(
                _toContractAddress,
                _ToUnipoolToken0,
                amountToSwap,
                _solidlyRouter,
                solidlyFactory,
                _stable
            );
            token1Bought = _amount - amountToSwap;
        }
    }

    function calculateSwapInAmount(uint256 reserveIn, uint256 userIn)
        internal
        pure
        returns (uint256)
    {
        return
            (Babylonian.sqrt(
                reserveIn * ((userIn * 3988000) + (reserveIn * 3988009))
            ) - (reserveIn * 1997)) / 1994;
    }

    /**
    @notice This function is used to swap ERC20 <> ERC20
    @param _FromTokenContractAddress The token address to swap from.
    @param _ToTokenContractAddress The token address to swap to. 
    @param tokens2Trade The amount of tokens to swap
    @return tokenBought The quantity of tokens bought
    */
    function _token2Token(
        address _FromTokenContractAddress,
        address _ToTokenContractAddress,
        uint256 tokens2Trade,
        address _solidlyRouter,
        IBaseV1Factory solidlyBaseV1Factory,
        bool _stable
    ) internal returns (uint256 tokenBought) {
        if (_FromTokenContractAddress == _ToTokenContractAddress) {
            return tokens2Trade;
        }

        _approveToken(_FromTokenContractAddress, _solidlyRouter, tokens2Trade);

        address pair = solidlyBaseV1Factory.getPair(
            _FromTokenContractAddress,
            _ToTokenContractAddress,
            _stable
        );
        require(pair != address(0), "No Swap Available");

        IBaseV1Router01.route[] memory path = new IBaseV1Router01.route[](1);
        path[0] = IBaseV1Router01.route(_FromTokenContractAddress, _ToTokenContractAddress, _stable);

        tokenBought = IBaseV1Router01(_solidlyRouter)
            .swapExactTokensForTokens(
                tokens2Trade,
                1,
                path,
                address(this),
                deadline
            )[path.length - 1];

        require(tokenBought > 0, "Error Swapping Tokens 2");
    }
}
