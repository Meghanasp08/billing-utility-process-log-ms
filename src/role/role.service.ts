import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationEnum } from 'src/common/constants/constants.enum';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { CreateRoleDto, SearchFilterDto } from './dto/create-role.dto';
import { User } from 'src/profile/schemas/user.schema';

@Injectable()
export class RoleService {
    constructor(
        @InjectModel('Role') private readonly rolesModel: Model<any>,
        @InjectModel('Permissions') private readonly permissionsModel: Model<any>,
        @InjectModel(User.name) private userModel: Model<any>,
    ) { }

    async create(createRoleDto: CreateRoleDto): Promise<any> {
        const exist = await this.rolesModel.findOne({ name: createRoleDto.name })
        if (exist) {
            throw new ConflictException('Name Already Exists')
        }
        const result = new this.rolesModel(createRoleDto);
        return await result.save();
    }

    async findAll(PaginationDTO: PaginationDTO): Promise<any> {
        var Offset = PaginationDTO.offset
            ? Number(PaginationDTO.offset)
            : PaginationEnum.OFFSET;
        var limit = PaginationDTO.limit
            ? Number(PaginationDTO.limit)
            : PaginationEnum.NO_LIMIT;

        const search = PaginationDTO?.search ? PaginationDTO?.search.trim() : null;

        const options = {
            isDeleted: false,
        };

        if (search) {
            options['$or'] = [
                { name: { $regex: search ? search : '', $options: 'i' } },
                { description: { $regex: search ? search : '', $options: 'i' } },
            ];
        }

        const count = await this.rolesModel.find(options).countDocuments();

        const roles = await this.rolesModel
            .find(options)
            .skip(Offset)
            .limit(limit)
            .lean<any>();

        const result = await Promise.all(
            roles.map(async (role) => {
                const count = await this.userModel.countDocuments({ role: role._id });
                return {
                    ...role,
                    usersCount: count,
                };
            })
        );

        return {
            result,
            pagination: {
                offset: Offset,
                limit: limit,
                total: count,
            },
        };
    }

    async findOne(ID: string) {
        const result = await this.rolesModel.findById(ID).lean<any>();
        result.usersCount = await this.userModel.countDocuments({ role: ID });
        return result
    }

    async findAllList(
        data: SearchFilterDto,
        PaginationDTO: PaginationDTO,
    ): Promise<any> {

        const search = PaginationDTO?.search ? PaginationDTO?.search.trim() : null;

        const options = {
            isDeleted: false,
        };

        if (search) {
            options['$or'] = [
                { name: { $regex: search ? search : '', $options: 'i' } },
                { description: { $regex: search ? search : '', $options: 'i' } },
            ];
        }
        const result = await this.rolesModel.find(options).select('name _id')

        return result;
    }

    async findAllPermission(PaginationDTO: PaginationDTO): Promise<any> {
        // var Offset = PaginationDTO.Offset
        //   ? Number(PaginationDTO.Offset)
        //   : PaginationEnum.OFFSET
        // var limit = PaginationDTO.limit ? Number(PaginationDTO.limit) : 50

        // const count = await this.permissionsModel
        //   .find({ isActive: true, isDeleted: false })
        //   .countDocuments()

        const result = await this.permissionsModel
            .find({ isActive: true, isDeleted: false })
        //   .skip(Offset)
        //   .limit(limit)

        return result
        // {

        //   pagination: {
        //     offset: Offset,
        //     limit: limit,
        //     total: count
        //   }
    }

    async update(ID: string, updateRoleDto: any) {

        const result = await this.rolesModel.findById(ID).exec()

        if (!result?._id) {
            throw new ConflictException('role not found')
        }
        
        if (updateRoleDto.isDeleted === true) {
            
            if (result?.isDefault === true) {
                throw new ConflictException('This role cannot be deleted.')
            }
            const assignedUserCount = await this.userModel.countDocuments({ role: ID });

            if (assignedUserCount > 0) {
                throw new ConflictException('This role cannot be deleted, there is already a user assigned to it.');
            }
        }

        await this.rolesModel.findByIdAndUpdate(ID, updateRoleDto).exec();
        return await this.rolesModel.findById(ID).exec();
    }

}
