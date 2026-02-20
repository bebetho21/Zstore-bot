require("dotenv").config()
const fs = require("fs")

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
StringSelectMenuBuilder,
ChannelType,
PermissionsBitField
} = require("discord.js")

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]})

let produtos = fs.existsSync("produtos.json") ? JSON.parse(fs.readFileSync("produtos.json")) : []
let pagamentoPix = {}

client.on("ready",()=>{
console.log("ONLINE")
})

client.on("messageCreate", async(message)=>{

if(message.author.bot) return

// COMANDOS
if(message.content === "!comandosbot"){
return message.reply(`
!criarproduto
!enviarproduto
!cadastrarpix
!chave
!confirmado
`)
}

// CADASTRAR PIX
if(message.content === "!cadastrarpix"){

if(!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Apenas admin")

const perguntar = async(pergunta)=>{
await message.channel.send(pergunta)
const filtro = m=>m.author.id === message.author.id
const coletado = await message.channel.awaitMessages({filter:filtro,max:1})
return coletado.first().content
}

pagamentoPix.titulo = await perguntar("Título:")
pagamentoPix.qr = await perguntar("Link do QR:")
pagamentoPix.chave = await perguntar("Chave Pix:")

message.reply("✅ Pix cadastrado")
}

// MOSTRAR PIX
if(message.content === "!chave"){

const embed = new EmbedBuilder()
.setTitle(pagamentoPix.titulo)
.setDescription(`\`\`\`${pagamentoPix.chave}\`\`\``)
.setImage(pagamentoPix.qr)

message.channel.send({embeds:[embed]})
}

if(message.content === "!confirmado"){
message.delete()
}

// CRIAR PRODUTO
if(message.content === "!criarproduto"){

const perguntar = async(pergunta)=>{
await message.channel.send(pergunta)
const filtro = m=>m.author.id === message.author.id
const coletado = await message.channel.awaitMessages({filter:filtro,max:1})
return coletado.first().content
}

let nome = await perguntar("Nome:")
let descricao = await perguntar("Descrição:")
let preco = await perguntar("Preço:")
let estoque = await perguntar("Estoque:")
let imagem = await perguntar("Link da imagem:")

// SELECT MENU CANAIS
let canais = message.guild.channels.cache
.filter(c=>c.type===ChannelType.GuildText)
.map(c=>{
return {
label:c.name.length<5?c.name+"....":c.name,
value:c.id,
description:"Selecionar canal"
}})

const menu = new StringSelectMenuBuilder()
.setCustomId("canal_produto")
.setPlaceholder("Pesquisar canal")
.addOptions(canais.slice(0,25))

const row = new ActionRowBuilder().addComponents(menu)

await message.channel.send({content:"Selecione o canal:",components:[row]})

const collector = message.channel.createMessageComponentCollector({time:60000})

collector.on("collect", async(i)=>{

if(i.customId==="canal_produto"){

produtos.push({
id:Date.now().toString(),
nome,
descricao,
preco,
estoque,
imagem,
canal:i.values[0]
})

fs.writeFileSync("produtos.json",JSON.stringify(produtos,null,2))

await i.reply({content:"✅ Produto criado",ephemeral:true})
collector.stop()
}
})
}

// ENVIAR PRODUTO
if(message.content === "!enviarproduto"){

let canais = message.guild.channels.cache
.filter(c=>c.type===ChannelType.GuildText)
.map(c=>{
return {
label:c.name.length<5?c.name+"....":c.name,
value:c.id,
description:"Selecionar canal"
}})

const menu = new StringSelectMenuBuilder()
.setCustomId("canal_enviar")
.setPlaceholder("Pesquisar canal")
.addOptions(canais.slice(0,25))

const row = new ActionRowBuilder().addComponents(menu)

await message.channel.send({content:"Selecione canal:",components:[row]})

const collector = message.channel.createMessageComponentCollector({time:60000})

collector.on("collect", async(i)=>{

if(i.customId==="canal_enviar"){

let canal = message.guild.channels.cache.get(i.values[0])

produtos.forEach(async(p)=>{

const embed = new EmbedBuilder()
.setTitle(p.nome)
.setDescription(p.descricao)
.setImage(p.imagem)
.addFields({name:"Preço",value:p.preco},{name:"Estoque",value:p.estoque})

const menu = new StringSelectMenuBuilder()
.setCustomId("comprar_"+p.id)
.setPlaceholder("Comprar")
.setMinValues(1)
.setMaxValues(1)
.addOptions([{
label:p.nome.length<5?p.nome+"....":p.nome,
description:p.descricao.length<5?p.descricao+"....":p.descricao,
value:"produto_"+p.id
}])

const row = new ActionRowBuilder().addComponents(menu)

canal.send({embeds:[embed],components:[row]})
})

await i.reply({content:"✅ Produtos enviados",ephemeral:true})
collector.stop()
}
})
}

})

client.on("interactionCreate", async(interaction)=>{

if(!interaction.isStringSelectMenu()) return

if(interaction.customId.startsWith("comprar_")){

let produto = produtos.find(p=>"produto_"+p.id===interaction.values[0])

let canal = await interaction.guild.channels.create({
name:"ticket-"+interaction.user.username,
type:ChannelType.GuildText,
permissionOverwrites:[
{ id:interaction.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{ id:interaction.user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]},
{ id:process.env.STAFF_ROLE_ID,allow:[PermissionsBitField.Flags.ViewChannel]}
]})

const btn = new ButtonBuilder()
.setCustomId("fechar")
.setLabel("Fechar Ticket")
.setStyle(ButtonStyle.Danger)

const row = new ActionRowBuilder().addComponents(btn)

canal.send({content:`${interaction.user}`,components:[row]})

interaction.reply({content:`Ticket criado: ${canal}`,ephemeral:true})
}

if(interaction.customId==="fechar"){

if(!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID) &&
interaction.user.id!==process.env.DONO_ID)
return interaction.reply({content:"❌ Sem permissão",ephemeral:true})

interaction.channel.delete()
}
})

client.login(process.env.TOKEN)