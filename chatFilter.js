
// 导入事件库
const iListenAttentively = require('./iListenAttentively-LseExport/lib/iListenAttentively.js');





const filterConfig = new JsonConfigFile("plugins/chatFilter/config.json", JSON.stringify({
    
    wordFiles: [
        "plugins/chatFilter/words/default.json",
        "plugins/chatFilter/words/custom.json"
    ],
    // 保留原始的words配置，作为默认配置
    words: {
        "傻瓜": {
            mode: "keyword",
            replacement: "**"
        },
        "笨蛋": {
            mode: "all",
            replacement: "***"
        }
    }
})) 

// 创建文件夹确保存在
file.mkdir("plugins/chatFilter/words");

function loadConfig() {
    // 确保主配置文件刷新
    filterConfig.reload();
    
    const wordFiles = filterConfig.get("wordFiles");
    let allWords = {};
    
    // 首先加载默认配置
    const defaultWords = filterConfig.get("words");
    if (defaultWords) {
        Object.assign(allWords, defaultWords);
    }
    
    // 遍历加载所有配置文件
    if (wordFiles && Array.isArray(wordFiles)) {
        for (const filePath of wordFiles) {
            try {
                const wordConfig = new JsonConfigFile(filePath, JSON.stringify({
                    words: {}
                }));
                // 确保配置文件刷新
                wordConfig.reload();
                const words = wordConfig.get("words");
                if (words) {
                    Object.assign(allWords, words);
                }
                // 使用完后关闭配置文件
                wordConfig.close();
            } catch (e) {
                logger.warn(`Failed to load word file: ${filePath}`);
            }
        }
    }
    
    return allWords;
}

// 保存配置的函数
function saveConfig(words) {
    const defaultWords = filterConfig.get("words");
    
    const newWords = {};
    for (const [word, config] of Object.entries(words)) {
        if (!defaultWords[word]) {
            newWords[word] = config;
        }
    }
    
    const customFilePath = "plugins/chatFilter/words/custom.json";
    const customConfig = new JsonConfigFile(customFilePath, JSON.stringify({
        words: {}
    }));
    
    customConfig.set("words", newWords);
    // 关闭配置文件
    customConfig.close();
}

// 记录敏感聊天到文件
function logSensitiveChat(message, filteredMessage) {
    const now = new Date();
    const timeString = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    const logContent = `[${timeString}] 原始消息: ${message} | 过滤后: ${filteredMessage}\n`;
    
    // 确保目录存在
    file.mkdir("plugins/chatFilter/logs");
    
    // 写入文件
    const logFile = "plugins/chatFilter/logs/sensitive_chat.log";
    file.writeLine(logFile, logContent);
}

// 监听聊天事件
iListenAttentively.emplaceListener(
    "ll::event::player::PlayerChatEvent",
    event => {
        const originalMessage = event["message"];
        const words = loadConfig();
        
        for (const [word, config] of Object.entries(words)) {
            let matched = false;
            let filteredMessage = originalMessage;
            
            switch(config.mode) {
                case "all":
                    if(originalMessage.includes(word)) {
                        filteredMessage = "*".repeat(originalMessage.length);
                        matched = true;
                    }
                    break;
                    
                case "keyword":
                    if(originalMessage.includes(word)) {
                        filteredMessage = originalMessage.replace(
                            new RegExp(word, 'g'), 
                            config.replacement || "*".repeat(word.length)
                        );
                        matched = true;
                    }
                    break;
                    
                case "regex":
                    try {
                        const regex = new RegExp(word, 'g');
                        if(regex.test(originalMessage)) {
                            filteredMessage = originalMessage.replace(
                                regex,
                                config.replacement || "****"
                            );
                            matched = true;
                        }
                    } catch(e) {
                        logger.warn(`Invalid regex pattern: ${word}`);
                    }
                    break;
            }
            
            if(matched) {
                logSensitiveChat(originalMessage, filteredMessage);
                event["message"] = filteredMessage;
                break;
            }
        }
    },
    iListenAttentively.EventPriority.High
);


