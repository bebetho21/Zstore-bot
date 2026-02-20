require("dotenv").config();
const fs = require("fs");

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
} = require("discord.js");

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]});

let produtos = {};
let pagamentoPix = {};

if (fs.existsSync("./produtos.json")) {
produtos = JSON.parse(fs.readFileSync("./produtos.json"));
}

if (fs.existsSync("./pix.json")) {
pagamentoPix = JSON.parse(fs.readFileSync("./pix.json"));
}

client.on("messageCreate", async (message)=>{

if(message.author.bot) return;

if(message.content === "!comandosbot"){
message.reply(`
📦 !criarproduto
📦 !enviarproduto
💳 !cadastrarpix
💳 !chave
✅ !confirmado
`);
}

if(message.content === "!cadastrarpix"){

if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
return message.reply("❌ Apenas administradores.");

const perguntar = async (pergunta) => {
await message.channel.send(pergunta);
const filtro = m => m.author.id === message.author.id;
const coletado = await message.channel.awaitMessages({filter:filtro,max:1});
return coletado.first().content;
};

const titulo = await perguntar("Digite o título do pagamento:");
const qr = await perguntar("Envie a URL da imagem do QR Code:");
const chave = await perguntar("Cole a chave Pix copia e cola:");

pagamentoPix.titulo = titulo;
pagamentoPix.qr = qr;
pagamentoPix.chave = chave;

fs.writeFileSync("./pix.json",JSON.stringify(pagamentoPix,null,2))

message.channel.send("✅ Pix cadastrado!");
}

if(message.content === "!chave"){

const embed = new EmbedBuilder()
.setTitle(pagamentoPix.titulo)
.setDescription(`💳 Chave Pix:\n\`\`\`${pagamentoPix.chave}\`\`\``)
.setImage(pagamentoPix.qr)

message.channel.send({embeds:[embed]});
}

if(message.content === "!confirmado"){
message.channel.bulkDelete(5)
}

if(message.content === "!criarproduto"){

const perguntar = async (pergunta) => {
await message.channel.send(pergunta);
const filtro = m => m.author.id === message.author.id;
const coletado = await message.channel.awaitMessages({filter:filtro,max:1});
return coletado.first().content;
};

const nome = await perguntar("Nome do produto:");
const descricao = await perguntar("Descrição:");
const preco = await perguntar("Preço:");
const estoque = await perguntar("Quantidade em estoque:");
const canal = await perguntar("ID do canal:");

const id = Date.now().toString()

produtos[id] = {nome,descricao,preco,estoque}

fs.writeFileSync("./produtos.json",JSON.stringify(produtos,null,2))

const menu = new StringSelectMenuBuilder()
.setCustomId("comprar_"+id)
.setPlaceholder("Selecione")
.setMinValues(1)
.setMaxValues(5)
.addOptions([{
label: nome.length < 5 ? nome+"...." : nome,
description: descricao.length < 5 ? descricao+"...." : descricao,
value: ("produto_"+id)
}])

const row = new ActionRowBuilder().addComponents(menu)

const embed = new EmbedBuilder()
.setTitle(nome)
.setDescription(descricao)
.addFields({name:"Preço",value:preco})

client.channels.cache.get(canal).send({embeds:[embed],components:[row]})

message.channel.send("✅ Produto criado!");
}
})

client.on("interactionCreate", async interaction => {

if(interaction.isStringSelectMenu()){

const id = interaction.values[0].replace("produto_","")

const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:ChannelType.GuildText,
permissionOverwrites:[
{
id:interaction.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},
{
id:interaction.user.id,
allow:[PermissionsBitField.Flags.ViewChannel]
}
]
})

const btn = new ButtonBuilder()
.setLabel("Ir para Ticket")
.setStyle(ButtonStyle.Link)
.setURL(`https://discord.com/channels/${interaction.guild.id}/${canal.id}`)

const fechar = new ButtonBuilder()
.setCustomId("fechar")
.setLabel("Fechar Ticket")
.setStyle(ButtonStyle.Danger)

const row = new ActionRowBuilder().addComponents(btn)
const row2 = new ActionRowBuilder().addComponents(fechar)

canal.send({content:`${interaction.user}`,components:[row,row2]})
interaction.reply({content:"Ticket criado!",ephemeral:true})

}

if(interaction.isButton()){

if(interaction.customId === "fechar"){

if(!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
return interaction.reply({content:"❌ Apenas staff!",ephemeral:true})

interaction.channel.delete()

}

}

})

client.login(process.env.TOKEN)