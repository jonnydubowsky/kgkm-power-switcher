function StreemWatcher(contract, eventNames, receiver, web3) {
  this.streems = [];
  this.numberOpenStreems = 0;
  this.onStreemsStarted = () => {};
  this.onStreemsStopped = () => {};

  this.contract = contract;
  this.eventNames = eventNames || {
    streemOpened: 'open',
    streemClosed: 'close',
  };
  this.receiver = receiver;
  this.web3 = web3;
}

StreemWatcher.prototype.start = async function () {
  // ignore open streems which were opened more than 5 blocks ago
  const blockNr = await this.web3.eth.getBlockNumber();
  const openEvents = await this.contract.getPastEvents(
    this.eventNames.streemOpened, { fromBlock: blockNr - 5 },
  );
  const closeEvents = await this.contract.getPastEvents(
    this.eventNames.streemClosed, { fromBlock: blockNr - 5 },
  );

  openEvents.forEach(event => this.handleOpenEvent(event));
  closeEvents.forEach(event => this.handleCloseEvent(event));
  this.calcNumberOpenStreems();

  //logging added for detecting if the raspberry looses the connection over time. 

  this.web3.eth.subscribe('newBlockHeaders').on('data', (blockHeader) => {
    console.log('block', blockHeader.number);
  }).on('error', (error) => {
    console.error('block error', error);
  });
    

  return this.contract.events.allEvents({}, (error, event) => {
    if (error) {
      console.error(error);
      return;
    }
    if (event.event === this.eventNames.streemOpened) {
      this.handleOpenEvent(event);
    } else if (event.event === this.eventNames.streemClosed) {
      this.handleCloseEvent(event);
    }
    this.calcNumberOpenStreems();
  });
};

StreemWatcher.prototype.handleOpenEvent = async function (event) {
  if (event.returnValues.to !== this.receiver) {
    return;
  }
  console.log(`Open streem #${event.returnValues.id}`);
  this.streems.push({ id: event.returnValues.id, open: true });
};

StreemWatcher.prototype.handleCloseEvent = async function (event) {
  if (event.returnValues.to !== this.receiver) {
    return;
  }
  console.log(`Close streem #${event.returnValues.id}`);
  this.streems = this.streems.map((streem) => {
    const s = streem;
    if (streem.id === event.returnValues.id) {
      s.open = false;
    }
    return s;
  });
};

StreemWatcher.prototype.calcNumberOpenStreems = async function () {
  const newNumberOpenStreems = this.streems.filter(s => s.open).length;
  // changed from no streems to some streems or other way around.
  const nowStopped = this.numberOpenStreems > 0 && newNumberOpenStreems <= 0;
  const nowStarted = this.numberOpenStreems <= 0 && newNumberOpenStreems > 0;
  if (nowStopped) {
    this.onStreemsStopped();
  }
  if (nowStarted) {
    this.onStreemsStarted();
  }
  this.numberOpenStreems = newNumberOpenStreems;
  console.log(`Number of open streems: ${this.numberOpenStreems}`);
};

exports.StreemWatcher = StreemWatcher;
