import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import {invokeScript, address, nodeInteraction, broadcast, waitForTx, balance, assetBalance, seedUtils, lease, cancelLease} from "@waves/waves-transactions"
import axios from 'axios'
import { LineChart, Line, CartesianGrid, XAxis, YAxis,Tooltip , Legend } from 'recharts';

class App extends Component {
  nodeUrl =  "http://127.0.0.1:6869"
  wvs = 100000000
  chainId = 'R'
  leasingNodeSeed = "minute sail fortune shuffle gun submit reveal few fever nest chunk slow actor peanut warmnodeProvider|1"
  leaseNodeProviderAddress = "3MMmugpEJgH414vS8MusoeKq91Vum1sHvg6"
  leaseNodeAddress = "3ME4Lp8uoqKGBY6NG7TSQYTtVJrNmRJ43cp"
  constructor(props) {
    super(props)
    this.state = {
      dataNeutrino: {},
      neutrinoAddress: "3MM4AETJutZVMZjjYUNg1MjbvQqQ7MCFjv8",
      seed: "minute sail fortune shuffle gun submit reveal few fever nest chunk slow actor peanut warm1",
      dataAuction: {},
      dataLease: {},
      swapWavesAmount: 1,
      swapNutrinoAmount: 1,
      price: 0.0,
      lastTxHash: "",
      dataOther: "",
      orderPrice: 0,
      orderAmount: 0,
      orderPosition: 0,
      bondOrderAmount: 0,
      orderWallBuy: true,
      orderWallStep: 0,
      initOrderWallPrice: 0,
      leasingSttings: [],
      leasingConfig: { nodeAddress: "", percent: 0 },
      withdrawLeasingBlock: 0,
      leaseId: ""
    }
    this.updateData()
    setInterval(() => this.updateData(), 600);
  }

  getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
  }
  convertToMap(array){
    let newMap = {}
    for(var key in array) {
        newMap[key] = array[key].value;
      }
    return newMap;
  }
  async updateData() {
    let result = await nodeInteraction.accountData(this.state.neutrinoAddress, this.nodeUrl)
    this.setState({ dataNeutrino: this.convertToMap(result) });
    result = await nodeInteraction.accountData(this.state.dataNeutrino.auction_contract, this.nodeUrl)
    this.setState({ dataAuction: this.convertToMap(result) });
    result = await nodeInteraction.accountData(this.state.dataNeutrino.lease_contract, this.nodeUrl)
    this.setState({ dataLease: this.convertToMap(result) });
    
    let supplyNUSD = 1000000000.00000000
    let supplyNUSDB = 1000000000
    let address = new seedUtils.Seed(this.state.seed, this.chainId).address

    let reserve = this.state.dataNeutrino.waves_reserve/this.wvs
    let supply = this.state.dataNeutrino.neutrino_supply/this.wvs
    let deficit = (supply - reserve * this.state.dataNeutrino.price/100)
    let other = {
        address : address,
        balance : await nodeInteraction.balance(address, this.nodeUrl),
        bondBalance: await nodeInteraction.assetBalance(this.state.dataNeutrino.bond_asset_id, address, this.nodeUrl),
        leaseNodeBalance: await nodeInteraction.balance(this.leaseNodeProviderAddress, this.nodeUrl),
        bondAuctionBalance: await nodeInteraction.assetBalance(this.state.dataNeutrino.bond_asset_id, this.state.dataNeutrino.auction_contract, this.nodeUrl),
        nusdBalance: await nodeInteraction.assetBalance(this.state.dataNeutrino.neutrino_asset_id, address, this.nodeUrl),
        deficit: Math.round(deficit)
    }
    this.setState({ dataOther: other });

    let response = await axios.get(this.nodeUrl + "/transactions/address/" + this.state.neutrinoAddress + "/limit/10000")
    let history = response["data"][0].sort((a, b) => (a.height > b.height) ? 1 : -1)
    let chart = []
    for(var key in history){
      let tx = history[key];
      if(tx.call == undefined)
        continue;
      if(tx.call.function != "setCurrentPrice")
        continue;

      chart.push({
        name: tx.height,
        price: tx.call.args[0].value/100
      })
    }

    this.setState({ chart: chart });
  }
  async sendTx(tx){
    try{
      await broadcast(tx, this.nodeUrl);
      this.setState({lastTxHash: tx.id})
      alert(tx.id)
    }catch(e){
      alert(e.name + ":" + e.message + "\n" + e.stack);
      console.log(e)
    }
  }

  setPriceHandleClick = async () => {
     const setPriceTx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "setCurrentPrice", args:[{type:"integer", value: this.state.price * 100}] },
      fee: 900000,
    }, this.state.seed);
    await this.sendTx(setPriceTx)
  }
  swapWavesToNeutrino = async () => {
    const tx = invokeScript({
            chainId: this.chainId,
            dApp: this.state.neutrinoAddress,
            call: {function: "swapWavesToNeutrino"},
            payment: [{assetId: null, amount: this.state.swapWavesAmount * this.wvs}]
        }, this.state.seed);
    await this.sendTx(tx)
  }
  swapNeutrinoToWaves = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "swapNeutrinoToWaves"},
      payment: [{assetId: this.state.dataNeutrino.neutrino_asset_id , amount: this.state.swapNutrinoAmount * this.wvs}]
    }, this.state.seed);
    await this.sendTx(tx)
  }
  generateBond = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "generateBond"}
    }, this.state.seed);
    await this.sendTx(tx)
  }
  setOrder = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.dataNeutrino.auction_contract,
      call: {function: "setOrder", args:[{type:"integer", value: this.state.orderPrice * 100}, {type:"integer", value: this.state.orderPosition }] },
      payment: [{assetId: this.state.dataAuction.neutrino_asset_id, amount: this.state.orderAmount * this.state.orderPrice * this.wvs}]
    }, this.state.seed);
    await this.sendTx(tx)
  }
  async cancelOrder(hash){
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.dataNeutrino.auction_contract,
      call: {function: "cancelOrder", args:[{type:"string", value: hash}] }
    }, this.state.seed);
    await this.sendTx(tx)
  }
  executeFirstOrder = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.dataNeutrino.auction_contract,
      call: {function: "execute" }
    }, this.state.seed);
    this.sendTx(tx)
  }
  getOrderbook() {
    if (this.state.dataAuction.orderbook == undefined)
      return [];
    let orders = this.state.dataAuction.orderbook.split("_")
    let orederbook = []
    orders.forEach(element => {
      if (element != "") {
        let filledTotal = this.state.dataAuction["order_filled_total_" + element]
        if(this.state.dataAuction["order_filled_total_" + element] === undefined)
          filledTotal = 0
        let total = (this.state.dataAuction["order_total_" + element] - filledTotal)/ this.wvs ;
        let price = this.state.dataAuction["order_price_" + element] / 100;
        let order = <div>{Math.round(total / price * this.wvs)/this.wvs}  | {price} | {total}</div>
        if (this.state.dataAuction["order_owner_" + element] == this.state.dataOther.address)
          order = <div>
                        {Math.round(total / price * this.wvs)/this.wvs}  | {price} | {total}
                    <button type="submit" onClick={this.cancelOrder.bind(this, element)}>X</button>
                  </div>
        orederbook.push(order)
      }
    });
    return orederbook;
  }
  getBondQueue() {
    if (this.state.dataNeutrino.orderbook == undefined)
      return [];
    let orders = this.state.dataNeutrino.orderbook.split("_")
    let orederbook = []
    orders.forEach(element => {
      if (element != "") {
        let amount = this.state.dataNeutrino["order_total_" + element];
        let order = <div>{amount}</div>
        if (this.state.dataNeutrino["order_owner_" + element] == this.state.dataOther.address)
          order = <div>
                      {amount}
                    <button type="submit" onClick={this.removeBondQueue.bind(this, element)}>X</button>
                  </div>
        orederbook.push(order)
      }
    });
    return orederbook;
  }
  addBondQueue = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "setOrder" },
      payment: [{assetId: this.state.dataNeutrino.bond_asset_id, amount: this.state.bondOrderAmount}]
    }, this.state.seed);
    await this.sendTx(tx)
  }
  async removeBondQueue(hash){
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "cancelOrder", args:[{type:"string", value: hash}] }
    }, this.state.seed);
    await this.sendTx(tx)
  }
  getBondQueueSnapshot() {
    if (this.state.dataNeutrino.orderbook_snapshot == undefined)
      return [];
    let orders = this.state.dataNeutrino.orderbook_snapshot.split("_")
    let orederbook = []
    orders.forEach(element => {
      if (element != "") {
        let amount = this.state.dataNeutrino["order_total_" + element];
        let order = <div>{amount}</div>
        if (this.state.dataNeutrino["order_owner_" + element] == this.state.dataOther.address)
          order = <div>
                      {amount}
                    <button type="submit" onClick={this.removeBondQueue.bind(this, element)}>X</button>
                  </div>
        orederbook.push(order)
      }
    });
    return orederbook;
  }
  executeFirstBondSnapshot = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "executeOrder" }
    }, this.state.seed);
    this.sendTx(tx)
  }
  createSnapshot = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "createSnapshot" }
    }, this.state.seed);
    await this.sendTx(tx)
  }
  createSnapshotBalance = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "snapshotNeutrino", args:[{type:"string", value: this.state.dataOther.address}] }
    }, this.state.seed);
    await this.sendTx(tx)
  }
  async getNewNeutrino(hash){
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "getNewNeutrino", args:[{type:"string", value: hash}] }
    }, this.state.seed);
    await this.sendTx(tx)
  }
  withdraw = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "withdraw", args:[{type:"string", value: this.state.dataOther.address }] }
    }, this.state.seed);
    await this.sendTx(tx)
  }
  getActualSnapshot(){
    let newMap = {}
    let array = this.state.dataNeutrino;
    for(var key in  array) {
      if(key.includes("lock_")){
        var hash = key.replace("lock_amount_","").replace("lock_owner_","").replace("lock_block_","");
        let block = array["lock_block_"+hash]
        if(block <= this.state.dataNeutrino.surplus_block && block != 0)
          newMap[hash] = {
            amount: array["lock_amount_"+hash],
            owner: array["lock_owner_"+hash],
            height: block
          }
      }
    }
    let snapshot = [];
    for(var key in newMap) {
      let info = newMap[key];
      let infoUi = <div>{info.owner} | {info.amount/this.wvs}</div>
      if (info.owner == this.state.dataOther.address)
        infoUi = <div>{info.owner} | {info.amount/this.wvs} <button type="submit" onClick={this.getNewNeutrino.bind(this, key)}>+</button></div>
      
        snapshot.push(<div>{infoUi}</div>)
    }
    return snapshot;
  }

  setOrderWall = async () => {
    await window.WavesKeeper.initialPromise;
    let price = parseFloat(this.state.initOrderWallPrice);
    for (let i = 0; i < this.state.orderWallIterations; i++) {
      console.log(this.state.orderWallBuy)

      await window.WavesKeeper.signAndPublishOrder({
        type: 1002,
        data: {
          matcherPublicKey: "8QUAqtTckM5B8gvcuP7mMswat9SjKUuafJMusEoSn1Gy",
          orderType: this.state.orderWallBuy == true ? "buy" : "sell",
          expiration: Date.now() + 2160000000,
          amount: {
            tokens: this.state.orderWallAmount,
            assetId: this.state.dataNeutrino.neutrino_asset_id
          },
          price: {
            tokens: price,
            assetId: "Waves"
          },
          matcherFee: {
            tokens: "0.03",
            assetId: "WAVES"
          }
        }
      });
      if (this.state.orderWallBuy == true)
        price -= parseFloat(this.state.orderWallStep);

      if (this.state.orderWallSell == true)
        price += parseFloat(this.state.orderWallStep);

    }
  }
      
  getAllSnapshot(){
    let newMap = {}
    let array = this.state.dataNeutrino;
    for(var key in  array) {
      if(key.includes("lock_")){
        var hash = key.replace("lock_amount_","").replace("lock_owner_","").replace("lock_block_","");
        let block = array["lock_block_"+hash]
        let surplus_block = this.state.dataNeutrino.surplus_block
        if(surplus_block == undefined)
          surplus_block = 0
        if(block > surplus_block)
          newMap[hash] = {
            amount: array["lock_amount_"+hash],
            owner: array["lock_owner_"+hash],
            height: block
          }
      }
    }
    let snapshot = [];
    for(var key in newMap) {
      let info = newMap[key];
      let infoUi = <div>{info.owner} | {info.amount/this.wvs}</div>
      if (info.owner == this.state.dataOther.address)
        infoUi = <div>{info.owner} | {info.amount/this.wvs}</div>
      
        snapshot.push(<div>{infoUi}</div>)
    }
    return snapshot;
  }

  nodeAddressChange = (event) => {
    let leasingConfig = this.state.leasingConfig
    leasingConfig.nodeAddress = event.target.value
    this.setState({ leasingConfig: leasingConfig });
  }
  percentChange = (event) => {
    let leasingConfig = this.state.leasingConfig
    leasingConfig.percent = event.target.value
    this.setState({ leasingConfig: leasingConfig })
  }

  getLeasingSetting(){
    if(this.state.dataLease["account_nodes_" + this.state.dataOther.address] == undefined)
      return [];
    let settins = this.state.dataLease["account_nodes_" + this.state.dataOther.address].split("_")
    let settingUi = []
    for (let index = 0; index < settins.length-1; index++) {
      let values = settins[index].split("+")
      let item = 
        <div>
          NodeAddress: {values[0]} {" "}
          Percent: {values[1]}% {" "}
          <button type="submit" onClick={this.removeLesingSetting.bind(this, index)}>X</button>
        </div> 
      settingUi.push(item)
    }
    return settingUi
  }
  getSnapshotLeasingSetting(){
    let block = this.state.dataLease["lease_prev_block_" + this.state.dataLease.lease_block]
    let key = "snapshot_account_nodes_" + this.state.dataOther.address + "_" + block
    if(this.state.dataLease[key] == undefined)
      return [];
    let settins = this.state.dataLease[key].split("_")
    let settingUi = []
    for (let index = 0; index < settins.length-1; index++) {
      let values = settins[index].split("+")

      let isExist = this.state.dataLease["n_executed_" + this.state.dataOther.address  + "_" + values[0] + "_" + this.state.dataLease.lease_block]
      if(isExist)
        continue;
      let item = 
        <div>
          NodeAddress: {values[0]} {" "}
          Percent: {values[1]}% {" "}
          <button type="submit" onClick={this.applyLeasingSettings.bind(this, index)}>+</button>
        </div> 
      settingUi.push(item)
    }
    return settingUi
  }
  async removeLesingSetting(position){
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.dataNeutrino.lease_contract,
      call: {function: "removeLeasingSettings", args: [{ value: position, type:"integer" }]}
    }, this.state.seed);
    await this.sendTx(tx)
  }

  addLeasingSetting = async () => {
    let leasingConfig = this.state.leasingConfig
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.dataNeutrino.lease_contract,
      call: {function: "addLeasingSettings", args: [{ value: leasingConfig.nodeAddress, type:"string" }, { value: leasingConfig.percent, type:"integer" }]}
    }, this.state.seed);

    leasingConfig.percent = 0
    leasingConfig.nodeAddress = ""
    this.setState({ leasingConfig: leasingConfig })
    await this.sendTx(tx)
  }
  async applyLeasingSettings(position){
    let leasingConfig = this.state.leasingConfig
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.dataNeutrino.lease_contract,
      call: {function: "applySettings", args: [{ value: this.state.dataOther.address, type:"string" }, { value: position, type:"integer" }]}
    }, this.state.seed);
    await this.sendTx(tx)
  }
  snapshotLeasingBalance = async () => { 
    let leasingConfig = this.state.leasingConfig
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.dataNeutrino.lease_contract,
      call: {function: "snapshotBalance", args: [{ value: this.state.dataOther.address, type:"string" }]}
    }, this.state.seed);
    await this.sendTx(tx)
  }
  finilizeSnapshots = async () => { 
    let leasingConfig = this.state.leasingConfig
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.dataNeutrino.lease_contract,
      call: {function: "finilizeSnapshots"}
    }, this.state.seed);
    await this.sendTx(tx)
  }
  
  snapshotLeasingSetting = async () => { 
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.dataNeutrino.lease_contract,
      call: {function: "snapshotLeasingSettings", args: [{ value: this.state.dataOther.address , type:"string" }]}
    }, this.state.seed);
    await this.sendTx(tx)
  }
  sendToLeasing = async () => {
    const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.state.neutrinoAddress,
      call: {function: "sendToLeasing", args: [{ value: this.leaseNodeProviderAddress , type:"string"}, {value: this.state.dataLease.lease_block , type:"integer" }]}
    }, this.state.seed);
    await this.sendTx(tx)
  }
  leaseTx = async () => {
    const tx = lease({
      chainId: this.chainId,
      amount: this.state.dataLease["node_balance_"+this.leaseNodeProviderAddress+"_"+this.state.dataLease.lease_block],
      recipient: this.leaseNodeAddress,
      fee: 500000
    }, this.leasingNodeSeed);
    await this.sendTx(tx)
  }
  cancelLeaseTx = async () => {
    const tx = cancelLease({
      chainId: this.chainId,
      leaseId: this.state.leaseId,
      fee: 500000
    }, this.leasingNodeSeed);
    await this.sendTx(tx)
  }
  withdrawLeasing = async () => {
     const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.leaseNodeProviderAddress,
      call: {function: "withdraw", args: [{ value: this.state.withdrawLeasingBlock, type:"integer" }]}
    }, this.state.seed);
    await this.sendTx(tx)
  }
  withdrawProfit = async () => {
     const tx = invokeScript({
      chainId: this.chainId,
      dApp: this.leaseNodeProviderAddress,
      call: {function: "withdrawProfit", args: [{ value: this.state.dataOther.address , type:"string" }, { value: this.state.withdrawLeasingBlock, type:"integer" }]}
    }, this.state.seed);
    await this.sendTx(tx)
  }
  render() {
    return (
      <div className="App">
        LastTxHash: {this.state.lastTxHash} | {' '}
        {this.state.dataOther.balance/this.wvs} Waves | {' '}
        {this.state.dataOther.bondBalance} Bond | {' '}
        {this.state.dataOther.nusdBalance/this.wvs} N-USD | {' '}
        <div id="grid">
          <div>
            <h3>Setting and other function</h3>

            <div>
              <h4>Seed</h4>
              <label>
                Seed: <input type="text" value={this.state.seed} onChange={() => this.setState({ seed: event.target.value })} />
              </label>
            </div>
            <div>
              <h4>Set new price</h4>
              <label>
                Price: <input type="text" value={this.state.price} onChange={() => this.setState({ price: event.target.value })} />
              </label>
              <button type="submit" onClick={this.setPriceHandleClick}>Set Price</button>
            </div>
            <div>
              <h4>Generate Bond(to auction)</h4>
              <button type="submit" onClick={this.generateBond}>Generate</button>
            </div>
            <div>
              <h4>Execute first order auction</h4>
              <button type="submit" onClick={this.executeFirstOrder}>Execute</button>
            </div>
            <div>
              <h4>Create all snapshot</h4>
              <button type="submit" onClick={this.createSnapshot}>Create</button>
            </div>
            <div>
              <h4>Execute first bond in queue(snapshot)</h4>
              <button type="submit" onClick={this.executeFirstBondSnapshot}>Execute</button>
            </div>
            <div>
              <h4>Set Wall</h4>
              <label>
                Init Price : <input type="text" value={this.state.initOrderWallPrice} onChange={() => this.setState({ initOrderWallPrice: event.target.value })} />
                <br/>Step : <input type="text" value={this.state.orderWallStep} onChange={() => this.setState({ orderWallStep: event.target.value })} />
                <br/>Amount : <input type="text" value={this.state.orderWallAmount} onChange={() => this.setState({ orderWallAmount: event.target.value })} />
                <br/>Iterations : <input type="text" value={this.state.orderWallIterations} onChange={() => this.setState({ orderWallIterations: event.target.value })} />
                 <div className="radio">
                  <label>
                  <input type="radio" checked={this.state.orderWallBuy === true}  onChange={() => this.setState({ orderWallBuy: true, orderWallSell: false  })}/>
                    Buy
                  </label>
                   <label>
                   <input type="radio" checked={this.state.orderWallSell === true}  onChange={() => this.setState({ orderWallBuy: false, orderWallSell: true  })}/>
                    Sell
                  </label>
                </div>
              </label>
              <br/><button type="submit" onClick={this.setOrderWall}>Set</button>
            </div>
          </div>
          <div>
            <h3>Vars</h3>
            Currency price: 1 waves = {this.state.dataNeutrino.price/100} USD<br/>
            Deficit: {this.state.dataOther.deficit} N-USD<br/> 

            Reserve: {this.state.dataNeutrino.waves_reserve/this.wvs} Waves<br/> 
            Supply: {this.state.dataNeutrino.neutrino_supply/this.wvs} N-USD<br/> 
            
            Snapshot block: {this.state.dataNeutrino.surplus_block}<br/> 
            Snapshot surplus: {this.state.dataNeutrino.surplus_amount/this.wvs} <br/> 
            Snapshot balance(current): {this.getActualSnapshot()} <br/> 
            Snapshot balance(all): {this.getAllSnapshot()} <br/> 

            <LineChart
              width={500}
              height={300}
              data={this.state.chart}
              margin={{
                top: 5, right: 30, left: 20, bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="price" stroke="#82ca9d" />
            </LineChart>

          </div>        
          <div>
            <h3>Swap</h3>
            Blocked Neutrino: {this.state.dataNeutrino["neutrino_" + this.state.dataOther.address]/this.wvs} <br/>
            Blocked Waves: {this.state.dataNeutrino["waves_" + this.state.dataOther.address]/this.wvs} <br/>
            Unblock block: {this.state.dataNeutrino["balance_block_" + this.state.dataOther.address] + 2} <br/>
            <button type="submit" onClick={this.withdraw}>Withdraw</button>
            <div>
              <h4>Swap Waves to Neutrino</h4>
              <label>
                Amount: <input type="text" value={this.state.swapWavesAmount} onChange={() => this.setState({ swapWavesAmount: event.target.value })} />
              </label>
              <button type="submit" onClick={this.swapWavesToNeutrino}>Swap</button>
            </div>

            <div>
              <h4>Swap Neutrino to Waves</h4>
              <label>
                Amount : <input type="text" value={this.state.swapNutrinoAmount} onChange={() => this.setState({ swapNutrinoAmount: event.target.value })} />
              </label>
              <button type="submit" onClick={this.swapNeutrinoToWaves}>Swap</button>
            </div>
          </div>
          <div>
            <h3>Auction</h3>
            Bond: {this.state.dataOther.bondAuctionBalance}
            <div>
              <h4>Set Order</h4>
              <label>
                Price : <input type="text" value={this.state.orderPrice} onChange={() => this.setState({ orderPrice: event.target.value })} />
                <br/>Amount : <input type="text" value={this.state.orderAmount} onChange={() => this.setState({ orderAmount: event.target.value })} />
                <br/>Position : <input type="text" value={this.state.orderPosition} onChange={() => this.setState({ orderPosition: event.target.value })} />
                <br/>Total : { Math.round(this.state.orderAmount * this.state.orderPrice * this.wvs)/this.wvs} N-USD
              </label>
              <br/><button type="submit" onClick={this.setOrder}>Set</button>
            </div>
            <div>
              <h4>Orderbook</h4>
              Amount | Price | Total
              {this.getOrderbook()}
            </div>
          </div>
          <div>
            <h3>Bond execute</h3>
            <div>
              <h4>Add Queue</h4>
              <label>
                Amount : <input type="text" value={this.state.bondOrderAmount} onChange={() => this.setState({ bondOrderAmount: event.target.value })} />
              </label>
              <br/><button type="submit" onClick={this.addBondQueue}>Add</button>
            </div>
            <div>
              <h4>Queue bond execute</h4>
              {this.getBondQueue()}
            </div>
          </div>
          <div>
            <h3>Snapshot</h3>
            <div>
              <h4>Create my snapshot</h4>
              <button type="submit" onClick={this.createSnapshotBalance}>Create</button>
            </div>
            <div>
              <h4>Queue bond execute Snapshot</h4>
              {this.getBondQueueSnapshot()}
            </div>
          </div>
          <div>
            <h3>Leasing</h3>
            PrevSnapshotBlock: {this.state.dataLease["lease_prev_block_" + this.state.dataLease.lease_block]}
            <br/>CurrentSnapshotBlock: { this.state.dataLease.lease_block}
            <div>
              <h4>Leasing Settings</h4>
              <label>
                {this.getLeasingSetting()}
                <div>
                  NodeAddress: <input type="text" value={this.state.leasingConfig.nodeAddress} onChange={this.nodeAddressChange} /> {" "}
                  Percent: <input type="text" value={this.state.leasingConfig.percent} onChange={this.percentChange} /> {" "}
                </div> 
              </label>
              <button type="submit" onClick={this.addLeasingSetting}>Apply</button>
            </div>
            <div>
              <h4>Snapshot leasing settings</h4>
              {this.getSnapshotLeasingSetting()}
              <button type="submit" onClick={this.snapshotLeasingSetting}>Create</button>
            </div>
             <div>
              <h4>Snapshot balance</h4>
              <button type="submit" onClick={this.snapshotLeasingBalance}>Create</button>
            </div>
            <div>
              <h4>Finilize Snapshots</h4>
              <button type="submit" onClick={this.finilizeSnapshots}>Create</button>
            </div>
          </div>
          <div>
           <div>
              <h3>Leasing</h3>
              Provider Address: {this.leaseNodeProviderAddress}
              <br />Address: {this.leaseNodeAddress}
              <br />Node Balance: {this.state.dataLease["node_balance_"+this.leaseNodeProviderAddress+"_"+this.state.dataLease.lease_block]/this.wvs}
              <br />Current Balance: {this.state.dataOther.leaseNodeBalance/this.wvs}
              <br/><button type="submit" onClick={this.sendToLeasing}>Send to leasing</button>
            </div>
            <div>
              <button type="submit" onClick={this.leaseTx}>Lease</button>
            </div>
            <div>
              <h4>Withdraw</h4>
              Block: <input type="text" value={this.state.withdrawLeasingBlock} onChange={()=>this.setState({withdrawLeasingBlock: event.target.value})} /> {" "}
              <button type="submit" onClick={this.withdrawLeasing}>Withdraw</button>
              <button type="submit" onClick={this.withdrawProfit}>withdrawProfit</button>
            <div>
              <h4>Cancel lease</h4>
              LeaseId: <input type="text" value={this.state.leaseId} onChange={()=>this.setState({leaseId: event.target.value})} /> {" "}
              <button type="submit" onClick={this.cancelLeaseTx}>Cancel</button>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
