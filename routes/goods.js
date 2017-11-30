var express = require('express');
var router = express.Router()
var mongoose = require('mongoose')
var Good = require('../models/goods')
var User = require('../models/user')
var superagent = require('superagent')

// 商品列表，在另一个项目中匹配接口时候有路由前缀  /goods/computer
router.get('/computer', function (req, res, next) {
    // 排序字段
    let sort = req.query.sort || '';
    // 分页的页码 +隐式转换
    let page = +req.query.page || 1;
    // 每页显示数据条数
    let pageSize = +req.query.pageSize || 20;
    // 价格区间中的最小值
    let priceGt = +req.query.priceGt || ''; // 大于
    // 价格区间中的最大值
    let priceLte = +req.query.priceLte || ''; // 小于
    // 跳过多少条
    let skip = (page - 1) * pageSize;  
    // 查询的参数条件
    let params = {}
    if (priceGt || priceLte) {
        if (priceGt && priceLte) {
            if (priceGt > priceLte) {
                var l = priceLte, g = priceGt
                priceGt = l
                priceLte = g
            }
            params = {
                'salePrice': {
                    $gt: priceGt,  //  >=最小值
                    $lte: priceLte  // <=最大值
                }
            }
        } else {
            params = {
                'salePrice': {
                    $gt: priceGt || 0,
                    $lte: priceLte || 99999
                }
            }
        }
    }

    let productModel = Good.find(params).skip(skip).limit(pageSize);
    // 1 升序 -1 降序
    sort && productModel.sort({'salePrice': sort})
    productModel.exec(function (err, doc) {
        if (err) {
            res.json({
                status: '1',
                msg: err.message,
                result: ''
            })
        } else {
            res.json({
                status: '0',
                msg: 'successful',
                result: {
                    count: doc.length,
                    data: doc
                }
            })
        }
    })
})

// 加入购物车
router.post('/addCart', function (req, res, next) {
    let userId = req.cookies.userId;
    let productId = req.body.productId;
    let productNum = req.body.productNum || 1;
    // 1.通过查询cookie，查询用户是否登录状态
    if (userId) { 
        // 2.查询数据库中是否有当前登录用户
        User.find({userId: userId}, function (err, userDoc) {
            if (err) {
                res.json({
                    status: '1',
                    msg: err.message,
                    result: ''
                })
            } else {
                // 3. 当前数据库存在登录的用户
                if (userDoc) {
                    var userDoc = userDoc[0]
                    var cartItem = '';
                    //  4.购物车有内容 先判断当前用户购物车是否已有即将要添加的商品，有便只增加数据，没有，先查询商品信息，在保存带cartList--》保存数据库
                    if (userDoc.cartList.length) {
                        // 4.1 遍历用户名下的购物车列表
                        userDoc.cartList.forEach(item => {
                            // 找到该商品，只将给商品的购买数量加上productNum即可
                            if (item.productId === productId) {
                                cartItem = item;   //当存在循环条件满足的时候，代表购物车已有此商品，将该商品赋值给cartItem变量，在下面的if判断中作为条件。
                                item.productNum += productNum;
                            }
                        })
                        // 如果购物车已经有要加入的商品，仅将增加的productNum保存的数据库即可。
                        if (cartItem) {
                            // 实例保存只能操作save()方法，对象保存可以操作insert,insertMany,create
                            userDoc.save(function (err2, doc2) {  
                                if (err2) {
                                    res.json({
                                        status: '1',
                                        msg: err2.message,
                                        result: ''
                                    })
                                } else {
                                    // 保存成功
                                    res.json({
                                        status: '0',
                                        msg: '加入成功',
                                        result: 'suc'
                                    })
                                }
                            })
                        }
                        // 购物车没有要加入购物车的商品，先查找要加入购物车商品的信息，然后插入到用户的cartList数组中，再在数据库中保存
                        if (!cartItem) {
                            Good.findOne({productId: productId}, function (err3, doc3) {
                                if (err3) {
                                    res.json({
                                        status: '1',
                                        msg: err3.message,
                                        result: ''
                                    })
                                } else {
                                    let doc = {
                                        "productId": doc3.productId,
                                        "productImg": doc3.productImageBig,
                                        "productName": doc3.productName,
                                        "checked": "1",
                                        "productNum": productNum,
                                        "productPrice": doc3.salePrice
                                    };
                                    userDoc.cartList.push(doc)
                                    userDoc.save(function (err2, doc2) {
                                        if (err2) {
                                            res.json({
                                                status: '1',
                                                msg: err2.message,
                                                result: ''
                                            })
                                        } else {
                                            // 保存成功
                                            res.json({
                                                status: '0',
                                                msg: '加入成功',
                                                result: 'suc'
                                            })
                                        }
                                    })
                                }
                            })
                        }

                    } else {
                        // 没找到 购物车没有内容 ，可以直接去查找商品信息，插入到用户的cartList数组里面，再进行保存数据到数据库即可。
                        Good.findOne({productId: productId}, function (err3, doc3) {
                            if (err3) {
                                res.json({
                                    status: '1',
                                    msg: err3.message,
                                    result: ''
                                })
                            } else {
                                let doc = {
                                    "productId": doc3.productId,
                                    "productImg": doc3.productImageBig,
                                    "productName": doc3.productName,
                                    "checked": "1",
                                    "productNum": 1,
                                    "productPrice": doc3.salePrice
                                };
                                userDoc.cartList.push(doc)
                                userDoc.save(function (err2, doc2) {
                                    if (err2) {
                                        res.json({
                                            status: '1',
                                            msg: err2.message,
                                            result: ''
                                        })
                                    } else {
                                        // 保存成功
                                        res.json({
                                            status: '0',
                                            msg: '加入成功',
                                            result: 'suc'
                                        })
                                    }
                                })
                            }
                        })
                    }
                } else {
                    console.log("没找到用户？？")
                    // 直接加入
                }
            }
        })
    } else {
        res.json({
            status: '1',
            msg: '未登录',
            result: ''
        })
    }
})

// 批量加入购物车
router.post('/addCart1', function (req, res) {
    let userId = req.cookies.userId,
        productMsg = req.body.productMsg;
        // 1.cookie查看用户是否登录
    if (userId) {
        User.findOne({userId}, (err, userDoc) => {
            if (err) {
                res.json({
                    status: '1',
                    msg: err.message,
                    result: ''
                })
            } else {
                // 2.用户是否在数据库中存在。
                if (userDoc) {
                    // 未添加的商品
                    let sx = [];
                    let newSx = [];  
                    //  3.1 购物车有内容
                    if (userDoc.cartList.length) {
                        // 遍历用户名下的购物车列表
                        userDoc.cartList.forEach((item, i) => {
                            // 找到该商品
                            productMsg.forEach((pro, j) => {
                                if (item.productId === pro.productId) {
                                    sx.push(j)
                                    item.productNum += pro.productNum
                                }     
                            })        
                        })
                        // 有不是重复的商品
                        if (sx.length !== productMsg.length) {
                            productMsg.forEach((item, i) => {
                                if (!sx.includes(i)) {//  找到未添加的,购物车里面还没有添加的商品
                                    newSx.push(item)
                                }
                            })
                        
                            let goodList1 = [], goodNum1 = []
                            newSx.forEach(item => {
                                goodList1.push(item.productId)
                                goodNum1.push(item.productNum)
                            })
                            Good.find({productId: {$in: goodList1}}, function (err3, goodDoc) {
                                if (err3) {
                                    res.json({
                                        status: '1',
                                        msg: err3.message,
                                        result: ''
                                    })
                                } else {
                                    var userCart = []
                                    // 返回一个还没有在购物车加入的商品的数组，循环加入到用户的cartList字段中。
                                    goodDoc.forEach((item, i) => {
                                        // userCart.push()
                                        userDoc.cartList.push({
                                            "productId": item.productId,
                                            "productImg": item.productImageBig,
                                            "productName": item.productName,
                                            "checked": "1",
                                            "productNum": goodNum1[i],
                                            "productPrice": item.salePrice
                                        })
                                    })
                                    // if (userCart.length) {
                                    userDoc.save(function (err2, doc2) {
                                        if (err2) {
                                            res.json({
                                                status: '1',
                                                msg: err2.message,
                                                result: ''
                                            })
                                        } else {
                                            // 保存成功
                                            res.json({
                                                status: '0',
                                                msg: '加入成功',
                                                result: 'suc'
                                            })
                                        }
                                    })
                                }
                            })
                        } else {
                            userDoc.save(function (err2, doc2) {
                                if (err2) {
                                    res.json({
                                        status: '1',
                                        msg: err2.message,
                                        result: ''
                                    })
                                } else {
                                    // 保存成功
                                    res.json({
                                        status: '0',
                                        msg: '加入成功',
                                        result: 'suc'
                                    })
                                }
                            })
                        }

                    } else {
                        // 3.2 购物车里面没有内容
                        var goodList = [], goodNum = []
                        productMsg.forEach(item => {
                            goodList.push(item.productId)
                            goodNum.push(item.productNum)
                        })
                        Good.find({productId: {$in: goodList}}, function (err3, doc) {
                            if (err3) {
                                res.json({
                                    status: '1',
                                    msg: err3.message,
                                    result: ''
                                })
                            } else {
                                console.log(doc)
                                // 返回一个数组，循环push到用户的cartList字段中，再保存
                                doc.forEach((item, i) => {
                                    userDoc.cartList.push({
                                        "productId": item.productId,
                                        "productImg": item.productImageBig,
                                        "productName": item.productName,
                                        "checked": "1",
                                        "productNum": goodNum[i],
                                        "productPrice": item.salePrice
                                    })
                                })
                                userDoc.save(function (err2, doc2) {
                                    if (err2) {
                                        res.json({
                                            status: '1',
                                            msg: err2.message,
                                            result: ''
                                        })
                                    } else {
                                        // 保存成功
                                        res.json({
                                            status: '0',
                                            msg: '加入成功',
                                            result: 'suc'
                                        })
                                    }
                                })
                            }
                        })
                    }
                }
            }
        })
    } else {
        res.json({
            status: '0',
            msg: '未登录',
            result: ''
        })
    }

})

let czUrl = 'http://www.smartisan.com/product/home'

// 转发锤子接口
router.get('/productHome', function (req, res) {
    superagent.get(czUrl).end(function (err, res1) {
        if (err) {
            res.json({
                status: '1',
                msg: err.message,
                result: ''
            })
        } else {
            let result = JSON.parse(res1.text)
            let home_hot = result.data.home_hot || ['100031816', '100032201', '100025104', '100023501'];
            let home_floors = result.data.home_floors
            let pId = [], // 保存总商品id
                hotId = [], // 热门id
                floorsId = [],// 官方精选 品牌精选
                floorsList = [];
            home_hot.forEach(item => {
                hotId.push(item.spu_id + '01')
                pId.push(item.spu_id + '01')
            })
            home_floors.forEach((item, i) => {
                let tab_items = item.tabs[0].tab_items // 
                floorsId[i] = []
                floorsList[i] = {};
                floorsList[i].tabs = [];
                floorsList[i].image = home_floors[i].tabs[0].tab_items[0]
                floorsList[i].title = home_floors[i].title
                tab_items.forEach(tab => {
                    let id = tab.spu_id
                    if (id) {
                        floorsId[i].push(id + '01') // 存储id
                        pId.push(id + '01')
                    }
                })
            })
            Good.find({productId: {$in: pId}}, (goodsErr, goodsDoc) => {
                if (goodsErr) {
                    res.json({
                        status: '1',
                        msg: goodsErr.message,
                        result: ''
                    })
                } else {
                    let hotList = [];
                    goodsDoc.forEach(item => {
                        let itemId = item.productId;
                        hotId.forEach(id => {
                            if (itemId === id) {
                                hotList.push(item)
                            }
                        })
                        floorsId.forEach((fitem, i) => {
                            fitem.forEach(fid => {
                                if (itemId === fid) {
                                    floorsList[i].tabs.push(item)
                                }
                            })
                        })
                    })
                    res.json({
                        status: '0',
                        msg: 'suc',
                        result: {
                            "home_hot": hotList,
                            'home_floors': floorsList
                        }
                    })
                }
            })


        }
    })
})

// 商品信息
router.get('/productDet', function (req, res) {
    let productId = req.query.productId
    Good.findOne({productId}, (err, doc) => {
        if (err) {
            res.json({
                status: '0',
                msg: err.message,
                result: ''
            })
        } else {
            res.json({
                status: '1',
                msg: 'suc',
                result: doc
            })
        }
    })
})

module.exports = router