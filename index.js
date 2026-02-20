require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
StringSelectMenuBuilder,
ChannelSelectMenuBuilder,
ChannelType,
PermissionsBitField
} = require("discord.js");

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const PRODUTOS_PATH = path.join(__dirname,"produtos.json");
const PIX_PATH = path.join(__dirname,"pix.json");

const CARGO_ADMIN_ID = "1464846406450942065";
const CARGO_STAFF_ID = "1464846409139359784";

let produtos = {};
let pixData = {};
let ticketCounter = 0;

function carregarProdutos(){
try{
if(!fs.existsSync(PRODUTOS_PATH)){
fs.writeFileSync(PRODUTOS_PATH,JSON.stringify({},null,2));
}
const data = fs.readFileSync(PRODUTOS_PATH,"utf8");
produtos = data ? JSON.parse(data) : {};
console.log("📦 Produtos carregados!");
}catch(e){
console.log(e);
produtos = {};
}
}

function salvarProdutos(){
fs.writeFileSync(PRODUTOS_PATH,JSON.stringify(produtos,null,2));
}

function carregarPix(){
try{
if(!fs.existsSync(PIX_PATH)){
fs.writeFileSync(PIX_PATH,JSON.stringify({},null,2));
}
pixData = JSON.parse(fs.readFileSync(PIX_PATH,"utf8"));
}catch{
pixData = {};
}
}

function salvarPix(){
fs.writeFileSync(PIX_PATH,JSON.stringify(pixData,null,2));
}

client.once("clientReady",()=>{
console.log(`✅ Online: ${client.user.tag}`);

carregarProdutos();
carregarPix();

fs.watchFile(PRODUTOS_PATH,()=>{
console.log("📦 produtos.json atualizado!");
carregarProdutos();
});
});

/* ================= COMANDOS ================= */

client.on("messageCreate", async(message)=>{

if(message.author.bot) return;

/* PIX */

if(message.content === "!cadastrarchave"){

if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Apenas admin.");

const filter = m => m.author.id === message.author.id;

await message.channel.send("Título:");
const titulo = await message.channel.awaitMessages({filter,max:1,time:60000});
if(!titulo.first()) return;

await message.channel.send("Chave PIX:");
const chave = await message.channel.awaitMessages({filter,max:1,time:60000});
if(!chave.first()) return;

await message.channel.send("URL QR Code:");
const qr = await message.channel.awaitMessages({filter,max:1,time:60000});
if(!qr.first()) return;

pixData={
titulo:titulo.first().content,
chave:chave.first().content,
qr:qr.first().content
}

salvarPix();
message.channel.send("✅ PIX salvo!");
}

/* PAGAMENTO */

if(message.content === "!pagamento"){

if(!pixData.titulo) return message.reply("❌ Nenhum PIX cadastrado.");

const embed=new EmbedBuilder()
.setTitle(pixData.titulo)
.setDescription(`🔑 Chave PIX:\n${pixData.chave}`)
.setImage(pixData.qr)
.setColor("Green");

const msg=await message.channel.send({embeds:[embed]});
pixData.msgId=msg.id;
salvarPix();
}

/* CRIAR PRODUTO */

if(message.content === "!criarproduto"){

if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Apenas admin.");

const filter=m=>m.author.id===message.author.id;

await message.channel.send("Nome:");
const nome=(await message.channel.awaitMessages({filter,max:1})).first().content;

await message.channel.send("Descrição:");
const descricao=(await message.channel.awaitMessages({filter,max:1})).first().content;

await message.channel.send("URL Imagem:");
const imagem=(await message.channel.awaitMessages({filter,max:1})).first().content;

await message.channel.send("Planos (1 por linha):");
const planosTexto=(await message.channel.awaitMessages({filter,max:1})).first().content;

const planos=planosTexto.split("\n").map((linha,index)=>({
label:linha.split("|")[0].trim(),
description:linha.split("|").slice(1).join("|").trim(),
value:`plano_${Date.now()}_${index}`
}));

produtos[nome]={nome,descricao,imagem,planos};
salvarProdutos();

message.channel.send("✅ Produto salvo!");
}

/* ENVIAR PRODUTO */

if(message.content === "!enviarproduto"){

if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return;

if(Object.keys(produtos).length===0)
return message.reply("❌ Nenhum produto.");

const menu=new StringSelectMenuBuilder()
.setCustomId("selecionar_produto")
.setPlaceholder("Escolha")
.addOptions(
Object.values(produtos).map(prod=>({
label:prod.nome,
description:prod.descricao.slice(0,100),
value:prod.nome
}))
);

message.channel.send({
content:"📦 Selecione:",
components:[new ActionRowBuilder().addComponents(menu)]
});
}

});

/* ================= INTERAÇÕES ================= */

client.on("interactionCreate", async(interaction)=>{

if(interaction.isStringSelectMenu()){

if(interaction.customId==="selecionar_produto"){

const produto=produtos[interaction.values[0]];

const menuCanal=new ChannelSelectMenuBuilder()
.setCustomId(`selecionar_canal_${produto.nome}`)
.setPlaceholder("Escolha o canal")
.addChannelTypes(ChannelType.GuildText);

return interaction.reply({
content:`Enviar **${produto.nome}** em qual canal?`,
components:[new ActionRowBuilder().addComponents(menuCanal)],
ephemeral:true
});
}

if(interaction.customId.startsWith("menu_compra_")){

const nomeProduto=interaction.customId.replace("menu_compra_","");
const produto=produtos[nomeProduto];
const plano=produto.planos.find(p=>p.value===interaction.values[0]);

ticketCounter++;

const canalTicket=await interaction.guild.channels.create({
name:`ticket-${ticketCounter}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{id:interaction.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
{id:interaction.user.id,allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.AttachFiles
]},
{id:CARGO_ADMIN_ID,allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.AttachFiles
]},
{id:CARGO_STAFF_ID,allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.AttachFiles
]}
]
});

const embed=new EmbedBuilder()
.setTitle("🛒 Pedido")
.setDescription(`👤 ${interaction.user}\n📦 ${produto.nome}\n💰 ${plano.label}\n\nEnvie fotos ou arquivos aqui se necessário.`)
.setColor("Green");

await canalTicket.send({embeds:[embed]});

interaction.reply({content:"✅ Ticket criado!",ephemeral:true});
}

}

if(interaction.isChannelSelectMenu()){

const nomeProduto=interaction.customId.replace("selecionar_canal_","");
const produto=produtos[nomeProduto];
const canal=interaction.guild.channels.cache.get(interaction.values[0]);

const embed=new EmbedBuilder()
.setTitle(produto.nome)
.setDescription(produto.descricao)
.setImage(produto.imagem)
.setColor("Blue");

const menuCompra=new StringSelectMenuBuilder()
.setCustomId(`menu_compra_${produto.nome}`)
.setPlaceholder("Escolha o plano")
.addOptions(produto.planos.map(p=>({
label:p.label,
description:p.description.slice(0,100),
value:p.value
})));

await canal.send({
embeds:[embed],
components:[new ActionRowBuilder().addComponents(menuCompra)]
});

interaction.update({content:"✅ Enviado!",components:[]});
}

});

client.login(process.env.TOKEN);