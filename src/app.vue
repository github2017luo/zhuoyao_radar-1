<template>
    <div id="app">
        <right-nav :version="APP_VERSION" :settings="settings"></right-nav>
        <div id="status" v-show="debug">
            <div id="info"><br/><span v-html="status"></span></div>
        </div>
        <div id="buttons">
            <el-button size="40px" @click="getScanningStart">妖灵扫描</el-button>
            <el-button size="40px" @click="getScanningStop">妖灵扫描关闭</el-button>
            <!--<el-button size="40px" @click="getScanningStartLeiTai">擂台扫描</el-button>-->
            <!--<el-button size="40px" @click="getScanningStopLeiTai">擂台扫描关闭</el-button>-->
            <el-button size="40px" @click="setCountUP">+</el-button>
            <el-button size="40px" @click="setCountDown">-</el-button>

            <template>
                <el-select v-model="name" filterable @change="switchLocale" placeholder="请选择">
                    <el-option
                            v-for="item in options"
                            :key="item.code"
                            :label="item.name"
                            :value="item.code"
                    >
                    </el-option>
                </el-select>
            </template>
        </div>


        <div id="qmap"></div>
    </div>
</template>
<script>
    import zuobiao from './components/zhuobiao/zuobiao';
    import area from './components/zhuobiao/provinces';
    import tempdata from './components/tempdata';
    import mixins from './components/mixins';
    import bot from './components/bot';
    import map from './components/map';
    import RadarWebSocket from './components/socket';
    import RightNav from './components/rightNav';
    import axios from 'axios'
    import {
        getLocalStorage,
        setLocalStorage,
        utf8ByteToUnicodeStr,
        convertLocation,
        json2buffer
    } from './components/util';

    import {
        FILTER,
        API_KEY,
        CUR_YAOLING_VERSION,
        APP_VERSION,
        BOT
    } from './config';

    export default {
        name: 'zhuoyao-radar',
        mixins: [mixins, bot, map],
        components: {
            RightNav
        },
        data() {


            return {
                location: {
                    longitude: 116.3579177856,
                    latitude: 39.9610780334
                },
                APP_VERSION,
                showNav: false, // 左侧菜单栏
                unknownKey: [],
                status: '',
                socket: {},
                map: {},
                debug: false,
                clickMarker: null, // 点击位置标记
                userMarker: null, // 用户位置标记
                firstTime: true, // 首次连接socket标记
                currVersion: CUR_YAOLING_VERSION, //190508版本的json 如果有变动手动更新
                statusOK: false,
                yaolings: tempdata.Data,
                markers: [],
                messageMap: new Map(), // 缓存请求类型和id
                settings: {
                    fit: {
                        t1: false,
                        t2: false,
                        all: false,
                        nest: false,
                        rare: true,
                        fish: false,
                        feature: false,
                        element: false
                    },
                    auto_search: false,
                    show_time: true,
                    position_sync: false,
                },
                botMode: false,
                botInterval: null,
                botTime: 0,
                botGroup: '799576270',
                botChecked: [],
                botWelcomeInfo: '捉妖扫描机器人2.1启动~有什么问题可以@我哦',
                botLocation: {
                    longitude: 116.3579177856,
                    latitude: 39.9610780334
                },
                count_yaoling: 0,
                count_leitai: 0,
                timer_yaoling: 'timer_yaoling',
                timer_leitai: 'timer_leitai',
                options: area.area.provinecs,
                name: '31',//默认选中上海
                lat: 31.2323578200,
                lon: 121.4692062700,
            };
        },
        mounted() {
            let settings = getLocalStorage('radar_settings');
            if (settings) {
                this.settings = settings;
                if (settings.position_sync) {
                    let location = getLocalStorage('radar_location');
                    if (location) {
                        this.location = location;
                    }
                }
            }

            // 初始化地图组件
            this.initMap(this.lat, this.lon);

            // 初始化websocket
            this.socket = new RadarWebSocket({
                onopen: this.onSocketOpen,
                onmessage: this.onSocketMessage
            });

            // 获取用户位置
            this.getLocation()
                .then(
                    position => {
                        this.location.longitude = position.longitude;
                        this.location.latitude = position.latitude;

                        var pos = new qq.maps.LatLng(
                            this.location.latitude,
                            this.location.longitude
                        );
                        this.map.panTo(pos);
                        this.userMarker = new qq.maps.Marker({
                            position: pos,
                            map: this.map
                        });
                    },
                    e => {
                        console.log(e);
                    }
                )
                .catch(b => {
                });

            this.addStatus('');
            this.$on('botSetup', params => {
                this.botSetup(params);
            });
        },
        methods: {
            /**
             * 跨域获取最新妖灵数据
             */
            getYaolings: function () {
                // var url = 'https://hy.gwgo.qq.com/sync/pet/config/' + this.currVersion;
                // try {
                //     $.getJSON(url,result => {
                //         console.log(result);
                //         this.statusOK = true;
                //     });
                //     console.log("1");
                // } catch(e) {
                //     console.log(e);
                //     console.log("3");
                // }
                // console.log("2");
                this.statusOK = true;
            },
            /**
             * 缓存响应的类型和id
             */
            genRequestId: function (type) {
                let _time = new Date().getTime() % 1234567;
                this.messageMap.set(`msg_${_time}`, type);
                return _time;
            },
            setCountUP: function () {
                this.count_yaoling += 10
                this.count_leitai += 10
            },
            setCountDown: function () {
                this.count_yaoling -= 10
                this.count_leitai -= 10
            },

            switchLocale: function () {
                //alert(this.name);
                if (this.name != "31") {
                    this.$notify({
                        title: '警告',
                        message: ' 该省份暂不支持扫描',
                        type: 'warning'
                    });
                }

            },
            /**
             * 根据id找到请求的类型
             */
            getRequestTypeFromId: function (id) {
                return this.messageMap.get(id);
            },

            onSocketOpen: function () {
                //this.addStatus('WSS连接开启');
                //console.log('WSS连接开启');
                this.notify('WSS连接开启');
                // 首次连接
                if (this.firstTime) {
                    this.firstTime = false;
                    this.getSettingFileName();
                    this.getBossLevelConfig();
                }
            },
            /**
             * 消息响应
             */
            onSocketMessage: function (event) {
                var blob = event.data;

                if (typeof blob !== 'string') {
                    var fileReader = new FileReader();
                    fileReader.onload = e => {
                        var arrayBuffer = e.target.result;
                        var n = utf8ByteToUnicodeStr(new Uint8Array(arrayBuffer).slice(4));

                        var data = JSON.parse(n);

                        this.handleMessage(data);
                    };
                    fileReader.readAsArrayBuffer(blob);
                }
            },

            /**
             * 根据查询结果过滤数据，打标记
             */
            buildMarkersByData: function (t) {
                //this.clearAllMarkers();

                t.forEach(item => {
                    if (
                        this.fit[0] === 'special' ||
                        this.fit.indexOf(item.sprite_id) > -1
                    ) {
                        this.notify('发现稀有怪');
                        this.addMarkers(item);
                        var url = "/api/zhuoyao/insert";
                        console.info(item)
                        axios.post(url, item).then(function (res) {
                        });
                    }
                });
                this.notify('筛选成功');
            },

            addStatusWithoutNewline: function (str) {
                this.status += str;
            },
            addStatus: function (str) {
                this.status += str + '<br>';
            },
            sendMessage: function (message, requestIndex) {

                this.socket.send(json2buffer(message));
            }
            ,
            /**
             * 自定刷新妖灵数据
             */
            getScanningStart: function () {
                if (this.timer_yaoling != 'timer_yaoling') {

                    this.$notify({
                        title: '警告',
                        message: '自动扫描已开始，请勿重复点击',
                        type: 'warning'
                    });
                    return
                }

                this.$notify({
                    title: '成功',
                    message: '自动扫描开始',
                    type: 'success'
                });
                this.timer_yaoling = setInterval(this.getTotelNumber, 2000)
                //alert(this.timer_yaoling);
            }
            ,
            getScanningStop: function () {
                clearInterval(this.timer_yaoling);
                this.timer_yaoling = 'timer_yaoling';
                this.$notify({
                    title: '成功',
                    message: '自动扫描关闭',
                    type: 'success'
                });
            }
            ,
            getScanningStopLeiTai: function () {
                clearInterval(this.timer_leitai);
                this.timer_leitai = 'timer_leitai';
                this.$notify({
                    title: '成功',
                    message: '自动扫描关闭',
                    type: 'success'
                });
            }
            ,
            getTotelNumber: function () {
                if (this.count_yaoling >= zuobiao.zuobiao.shanghai.length) {
                    this.count_yaoling = 0;
                }
                if (this.count_yaoling < 0) {
                    this.count_yaoling = 0;
                }
                //console.info(this.count_yaoling)
                var e = {
                    request_type: '1001',
                    longtitude: zuobiao.zuobiao.shanghai[this.count_yaoling].lon,
                    latitude: zuobiao.zuobiao.shanghai[this.count_yaoling].lat,
                    requestid: this.genRequestId('1001'),
                    platform: 0
                };
                this.count_yaoling = this.count_yaoling + 1
                this.sendMessage(e, '1001');

            },
            getTotelNumberLeiTai: function () {
                if (this.count_leitai >= zuobiao.zuobiao.shanghai.length) {
                    this.count_leitai = 0;
                }
                if (this.count_leitai < 0) {
                    this.count_leitai = 0;
                }
                //console.info(this.count_leitai)
                var e = {
                    request_type: '1002',
                    longtitude: zuobiao.zuobiao.shanghai[this.count_leitai].lon,
                    latitude: zuobiao.zuobiao.shanghai[this.count_leitai].lat,
                    requestid: this.genRequestId('1002'),
                    platform: 0
                };
                this.count_leitai = this.count_leitai + 1
                this.sendMessage(e, '1002');

            },

            /**
             * 自定刷新妖灵数据
             */
            getScanningStartLeiTai: function () {
                if (this.timer_leitai != 'timer_leitai') {

                    this.$notify({
                        title: '警告',
                        message: '自动扫描已开始，请勿重复点击',
                        type: 'warning'
                    });
                    return
                }

                this.$notify({
                    title: '成功',
                    message: '自动扫描开始',
                    type: 'success'
                });
                //this.timer_leitai = setInterval(this.getTotelNumber, 2000)
                //34.263416259558504,117.88740631991502

                this.timer_leitai = setInterval(this.getTotelNumberLeiTai, 2000)
                alert(this.timer_leitai);
            }
            ,
            /**
             * 获取擂台数据
             */
            getLeitaiInfo: function () {
                this.addStatus('功能开发中!');
                this.notify('功能开发中!');
                return;
                if (!this.statusOK || this.botMode) return;
                var e = {
                    request_type: '1002',
                    longtitude: convertLocation(this.location.longitude),
                    latitude: convertLocation(this.location.latitude),
                    requestid: this.genRequestId('1002'),
                    platform: 0
                };
                this.sendMessage(e, '1002');
            },
            getSettingFileName: function () {
                var e = {
                    request_type: '1004',
                    cfg_type: 1,
                    requestid: this.genRequestId('10041'),
                    platform: 0
                };
                this.sendMessage(e, '10041');
            },
            getBossLevelConfig: function () {
                return;
                var e = {
                    request_type: '1004',
                    cfg_type: 0,
                    requestid: this.genRequestId('10040'),
                    platform: 0
                };
                this.sendMessage(e, '10040');
            },
            /**
             * 地图中心改变
             */
            mapCenterChanged(position) {
                var c = this.map.getCenter();
                setLocalStorage('radar_location', {
                    longitude: c.lng,
                    latitude: c.lat,
                });
            }
        },
        computed: {
            fit: function () {
                let ans = [];
                let _fit = this.settings.fit;
                if (_fit.all) {
                    return ['special'];
                }

                // 根据值把key转换成FILTER_FISH这种，取常量配置中的值
                for (let _f in _fit) {
                    if (_fit[_f]) {
                        let _arr = FILTER[`FILTER_${_f.toLocaleUpperCase()}`];
                        ans = ans.concat(_arr);
                    }
                }
                return Array.from(new Set(ans));
            }
        },
        watch: {
            settings: {
                handler: function (newV, oldV) {
                    console.log('settings update...');
                    setLocalStorage('radar_settings', this.settings);
                },
                deep: true
            }
        }
    };
</script>
<style lang='less'>
</style>

