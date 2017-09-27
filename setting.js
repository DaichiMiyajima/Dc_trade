var setting = {};

setting.runningmode = 'verification' //production,verification

setting.parentpass = 'production/'
setting.commonpass = setting.parentpass + 'common'
setting.systempass = setting.commonpass + '/system'
setting.systemkey = 'system'
setting.runningpass = setting.systempass + '/running';
setting.linepass = setting.systempass + '/line';
setting.tradestatus = 'tradestatus';
setting.tradestatuspass = setting.commonpass + '/tradestatus';
setting.request = 'Request';
setting.orderstatus = 'orderstatus';

setting.thinkpass = setting.parentpass + 'think'
setting.notyetpass = setting.thinkpass + '/order';

setting.tradepass = setting.parentpass + 'trade';
setting.finishedpass = setting.tradepass + '/orderFinished';
setting.completedpass = setting.tradepass + '/orderCompleted';
setting.orderFailedPass = setting.tradepass + '/orderfailed';

setting.orderbackuppass = setting.parentpass + 'orderbackup';

//変換が必要なpairとformatedpairの組み合わせを登録
setting.needfiatChange = [
    {'pair': 'BTC_JPY', 'formatedpair': 'BTC_USD', 'currencyPairCode': 'USDJPY'}
]

setting.minimumtrade = {
    poloniex : 0.0001,
    kraken : 0.01,
    bitflyer : 0.01,
    quoine : 0.01
}

module.exports = setting;
